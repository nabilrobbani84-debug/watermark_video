import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Job } from './types.ts';

// Configurable ephemeral retention (default 15 minutes = 900 seconds)
const RETENTION_MS = Number(process.env.JOB_RETENTION_SECONDS || 900) * 1000;
const EPHEMERAL_BASE_DIR = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.resolve(os.tmpdir(), 'vanishframe-ephemeral-jobs');

declare global {
  var __vanishframe_jobsRegistry: Map<string, Job> | undefined;
  var __vanishframe_activeProcesses: Map<string, { kill: (signal?: NodeJS.Signals | number) => void }> | undefined;
  var __vanishframe_cleanupInitialized: boolean | undefined;
}

// In-memory registry of active jobs (shared across Next.js dev bundles/workers via globalThis)
const jobsRegistry: Map<string, Job> =
  globalThis.__vanishframe_jobsRegistry ?? new Map<string, Job>();
globalThis.__vanishframe_jobsRegistry = jobsRegistry;

// Active running child processes per job (for clean cancellation)
const activeProcesses: Map<string, { kill: (signal?: NodeJS.Signals | number) => void }> =
  globalThis.__vanishframe_activeProcesses ?? new Map<string, { kill: (signal?: NodeJS.Signals | number) => void }>();
globalThis.__vanishframe_activeProcesses = activeProcesses;

export async function ensureEphemeralDir(): Promise<string> {
  await fs.mkdir(EPHEMERAL_BASE_DIR, { recursive: true });
  initCleanupTimer();
  return EPHEMERAL_BASE_DIR;
}

export function sanitizeFileName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return sanitized.length > 0 ? sanitized : 'video.mp4';
}

export function isSafePath(targetPath: string): boolean {
  if (!targetPath) return false;
  const resolved = path.resolve(targetPath);
  const baseResolved = path.resolve(EPHEMERAL_BASE_DIR);
  // Case-insensitive comparison on Windows
  if (process.platform === 'win32') {
    return resolved.toLowerCase().startsWith(baseResolved.toLowerCase());
  }
  return resolved.startsWith(baseResolved);
}

export function registerActiveProcess(
  jobId: string,
  proc: { kill: (signal?: NodeJS.Signals | number) => void },
) {
  activeProcesses.set(jobId, proc);
}

export function unregisterActiveProcess(jobId: string) {
  activeProcesses.delete(jobId);
}

export function killActiveProcess(jobId: string) {
  const proc = activeProcesses.get(jobId);
  if (proc) {
    try {
      proc.kill('SIGKILL');
    } catch {
      // process may have already exited
    }
    activeProcesses.delete(jobId);
  }
}

/**
 * Persists job metadata to disk in the ephemeral directory.
 * Ensures survival across server restarts and cross-process access.
 */
export function persistJobToDisk(job: Job): void {
  try {
    const jobDir = path.join(EPHEMERAL_BASE_DIR, job.id);
    if (!isSafePath(jobDir)) return;
    if (!fsSync.existsSync(jobDir)) {
      fsSync.mkdirSync(jobDir, { recursive: true });
    }
    const metaPath = path.join(jobDir, 'job.json');
    fsSync.writeFileSync(metaPath, JSON.stringify(job), 'utf8');
  } catch {
    // Non-fatal if ephemeral sync fails
  }
}

/**
 * Loads job metadata from disk if not present in memory.
 */
function loadJobFromDisk(id: string): Job | undefined {
  try {
    const jobDir = path.join(EPHEMERAL_BASE_DIR, id);
    if (!isSafePath(jobDir)) return undefined;
    const metaPath = path.join(jobDir, 'job.json');
    if (fsSync.existsSync(metaPath)) {
      const content = fsSync.readFileSync(metaPath, 'utf8');
      const job = JSON.parse(content) as Job;
      return job;
    }
  } catch {
    // Corrupt or inaccessible job file
  }
  return undefined;
}

export async function createJob(): Promise<Job> {
  await ensureEphemeralDir();
  const id = randomUUID();
  // Generate 32 bytes (256 bits) secure cryptographic token
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + RETENTION_MS;

  const jobDir = path.join(EPHEMERAL_BASE_DIR, id);
  await fs.mkdir(jobDir, { recursive: true });

  const job: Job = {
    id,
    token,
    status: 'CREATED',
    progress: 0,
    stageMessage: 'Job initialized',
    createdAt: now,
    updatedAt: now,
    expiresAt,
    processingMethod: 'delogo-interpolated',
  };

  jobsRegistry.set(id, job);
  persistJobToDisk(job);
  return job;
}

export function getJob(id: string): Job | undefined {
  if (!id) return undefined;

  let job = jobsRegistry.get(id);
  if (!job) {
    job = loadJobFromDisk(id);
    if (job) {
      jobsRegistry.set(id, job);
    }
  }

  if (!job) return undefined;

  // Check if expired
  if (Date.now() > job.expiresAt && job.status !== 'EXPIRED') {
    job.status = 'EXPIRED';
    job.stageMessage = 'Job session expired. Temporary files purged.';
    killActiveProcess(id);
    persistJobToDisk(job);
    void purgeJobFiles(job);
  }

  return job;
}

/**
 * Timing-safe cryptographic comparison of job session tokens.
 */
export function verifyJobToken(job: Job, token?: string | null): boolean {
  if (!token || !job?.token) return false;
  const cleanToken = token.trim();
  const expected = Buffer.from(job.token);
  const actual = Buffer.from(cleanToken);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const job = getJob(id);
  if (!job) return undefined;

  Object.assign(job, updates, { updatedAt: Date.now() });
  persistJobToDisk(job);
  return job;
}

export async function purgeJobFiles(job: Job): Promise<void> {
  killActiveProcess(job.id);
  const jobDir = path.join(EPHEMERAL_BASE_DIR, job.id);
  try {
    if (isSafePath(jobDir)) {
      await fs.rm(jobDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore ENOENT / permission race
  }
}

export async function deleteJob(id: string, token: string): Promise<boolean> {
  const job = getJob(id);
  if (!job) return false;
  if (!verifyJobToken(job, token)) return false;

  killActiveProcess(id);
  job.status = 'CANCELLED';
  job.stageMessage = 'Job cancelled and files removed';
  await purgeJobFiles(job);
  jobsRegistry.delete(id);
  return true;
}

export function getJobDir(jobId: string): string {
  const dir = path.join(EPHEMERAL_BASE_DIR, jobId);
  if (!isSafePath(dir)) {
    throw new Error('Invalid job directory path traversal attempt');
  }
  return dir;
}

// Background cleanup worker for expired jobs
function initCleanupTimer() {
  if (globalThis.__vanishframe_cleanupInitialized) return;
  globalThis.__vanishframe_cleanupInitialized = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobsRegistry.entries()) {
      if (now > job.expiresAt) {
        job.status = 'EXPIRED';
        killActiveProcess(id);
        await purgeJobFiles(job);
        if (now > job.expiresAt + 60000) {
          jobsRegistry.delete(id);
        }
      }
    }
  }, 30000).unref();
}
