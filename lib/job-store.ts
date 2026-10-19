import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Job, JobStatus, ProcessingMethod } from './types.ts';

// Configurable ephemeral retention (default 15 minutes = 900 seconds)
const RETENTION_MS = Number(process.env.JOB_RETENTION_SECONDS || 900) * 1000;
const EPHEMERAL_BASE_DIR = path.join(os.tmpdir(), 'vanishframe-ephemeral-jobs');

// In-memory registry of active jobs
const jobsRegistry = new Map<string, Job>();

let isCleanupInitialized = false;

export async function ensureEphemeralDir(): Promise<string> {
  await fs.mkdir(EPHEMERAL_BASE_DIR, { recursive: true });
  initCleanupTimer();
  return EPHEMERAL_BASE_DIR;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function isSafePath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const baseResolved = path.resolve(EPHEMERAL_BASE_DIR);
  return resolved.startsWith(baseResolved);
}

export async function createJob(): Promise<Job> {
  await ensureEphemeralDir();
  const id = randomUUID();
  const token = randomBytes(24).toString('hex');
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
  return job;
}

export function getJob(id: string): Job | undefined {
  const job = jobsRegistry.get(id);
  if (!job) return undefined;

  // Check if expired
  if (Date.now() > job.expiresAt && job.status !== 'EXPIRED') {
    job.status = 'EXPIRED';
    job.stageMessage = 'Job session expired. Temporary files purged.';
    void purgeJobFiles(job);
  }

  return job;
}

export function verifyJobToken(job: Job, token?: string | null): boolean {
  if (!token) return false;
  return job.token === token;
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const job = getJob(id);
  if (!job) return undefined;

  Object.assign(job, updates, { updatedAt: Date.now() });
  return job;
}

export async function purgeJobFiles(job: Job): Promise<void> {
  const jobDir = path.join(EPHEMERAL_BASE_DIR, job.id);
  try {
    if (isSafePath(jobDir)) {
      await fs.rm(jobDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore ENOENT
  }
}

export async function deleteJob(id: string, token: string): Promise<boolean> {
  const job = getJob(id);
  if (!job) return false;
  if (!verifyJobToken(job, token)) return false;

  job.status = 'CANCELLED';
  job.stageMessage = 'Job cancelled and files removed';
  await purgeJobFiles(job);
  jobsRegistry.delete(id);
  return true;
}

export function getJobDir(jobId: string): string {
  const dir = path.join(EPHEMERAL_BASE_DIR, jobId);
  if (!isSafePath(dir)) {
    throw new Error('Invalid job directory path');
  }
  return dir;
}

// Background cleanup worker for expired jobs
function initCleanupTimer() {
  if (isCleanupInitialized) return;
  isCleanupInitialized = true;

  // Check every 60 seconds
  setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobsRegistry.entries()) {
      if (now > job.expiresAt) {
        job.status = 'EXPIRED';
        await purgeJobFiles(job);
        // keep expired record briefly then delete
        if (now > job.expiresAt + 60000) {
          jobsRegistry.delete(id);
        }
      }
    }
  }, 60000).unref();
}
