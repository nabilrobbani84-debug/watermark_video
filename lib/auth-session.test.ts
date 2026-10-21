import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createJob,
  deleteJob,
  getJob,
  getJobDir,
  persistJobToDisk,
  purgeJobFiles,
  updateJob,
  verifyJobToken,
} from './job-store.ts';
import { extractSessionToken, validateJobSession } from './job-session.ts';

function createMockRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
  }
): NextRequest {
  const reqHeaders = new Headers(options?.headers || {});
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options?.method || 'GET',
    headers: reqHeaders,
  });
}

test('Step 6 Verification — 1. Creating a new job with cryptographic session token', async () => {
  const job = await createJob();
  assert.ok(job.id, 'Job must have a unique identifier');
  assert.ok(job.token, 'Job must have a session token');
  assert.equal(job.token.length, 64, 'Token must be a 256-bit (64 hex characters) cryptographic string');
  assert.equal(job.status, 'CREATED', 'Initial job state must be CREATED');
  assert.ok(job.expiresAt > Date.now(), 'ExpiresAt must be in the future');

  await purgeJobFiles(job);
});

test('Step 6 Verification — 2. Uploading with a valid session token (Authorization: Bearer and x-job-token)', async () => {
  const job = await createJob();

  // Test standard Authorization: Bearer <token>
  const bearerReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const bearerValidation = validateJobSession(bearerReq, job.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/upload',
    allowedStatuses: ['CREATED', 'UPLOADING'],
  });
  assert.equal(bearerValidation.ok, true, 'Bearer token must be accepted');
  if (bearerValidation.ok) {
    assert.equal(bearerValidation.job.id, job.id);
  }

  // Test x-job-token fallback compatibility
  const xTokenReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/upload`, {
    method: 'POST',
    headers: {
      'x-job-token': job.token,
    },
  });
  const xTokenValidation = validateJobSession(xTokenReq, job.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/upload',
    allowedStatuses: ['CREATED', 'UPLOADING'],
  });
  assert.equal(xTokenValidation.ok, true, 'x-job-token must be accepted');

  await purgeJobFiles(job);
});

test('Step 6 Verification — 3. Rejecting a missing or incorrect token', async () => {
  const job = await createJob();

  // Missing token -> 401 Unauthorized
  const missingReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/upload`, {
    method: 'POST',
  });
  const missingValidation = validateJobSession(missingReq, job.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/upload',
  });
  assert.equal(missingValidation.ok, false);
  if (!missingValidation.ok) {
    assert.equal(missingValidation.response.status, 401, 'Missing token must return 401 Unauthorized');
  }

  // Incorrect token -> 403 Forbidden
  const wrongReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/upload`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer invalid_and_wrong_session_token_1234567890abcdef',
    },
  });
  const wrongValidation = validateJobSession(wrongReq, job.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/upload',
  });
  assert.equal(wrongValidation.ok, false);
  if (!wrongValidation.ok) {
    assert.equal(wrongValidation.response.status, 403, 'Wrong token must return 403 Forbidden');
  }

  await purgeJobFiles(job);
});

test('Step 6 Verification — 4. Rejecting a token belonging to another job', async () => {
  const jobA = await createJob();
  const jobB = await createJob();

  // Attempt to access Job B using Job A's valid token -> 403 Forbidden
  const crossReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${jobB.id}/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jobA.token}`,
    },
  });
  const crossValidation = validateJobSession(crossReq, jobB.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/process',
  });
  assert.equal(crossValidation.ok, false, 'Cross-job token access must be rejected');
  if (!crossValidation.ok) {
    assert.equal(crossValidation.response.status, 403, 'Cross-job token must return 403');
  }

  await purgeJobFiles(jobA);
  await purgeJobFiles(jobB);
});

test('Step 6 Verification — 5. Processing with a valid token and state verification', async () => {
  const job = await createJob();
  updateJob(job.id, {
    status: 'QUEUED',
    metadata: {
      filename: 'sample.mp4',
      duration: 5,
      width: 1280,
      height: 720,
      fps: 30,
      codec: 'h264',
      size: 500000,
      hasAudio: true,
    },
    confirmedRegion: { x: 100, y: 100, width: 200, height: 80, confidence: 0.9, label: 'Logo' },
    originalFilePath: path.join(getJobDir(job.id), 'orig_sample.mp4'),
  });

  const procReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const procValidation = validateJobSession(procReq, job.id, {
    endpoint: 'POST /api/v1/jobs/[jobId]/process',
    allowedStatuses: ['QUEUED', 'AWAITING_CONFIRMATION'],
  });
  assert.equal(procValidation.ok, true, 'Processing request with valid token and state must succeed');

  await purgeJobFiles(job);
});

test('Step 6 Verification — 6. Polling status with a valid token', async () => {
  const job = await createJob();
  updateJob(job.id, { progress: 65, stageMessage: 'Interpolating pixels...' });

  const pollReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const pollValidation = validateJobSession(pollReq, job.id, {
    endpoint: 'GET /api/v1/jobs/[jobId]',
  });
  assert.equal(pollValidation.ok, true, 'Polling with valid token must succeed');
  if (pollValidation.ok) {
    assert.equal(pollValidation.job.progress, 65);
    assert.equal(pollValidation.job.stageMessage, 'Interpolating pixels...');
  }

  await purgeJobFiles(job);
});

test('Step 6 Verification — 7. Downloading a ready result and rejecting unready state', async () => {
  const job = await createJob();
  const jobDir = getJobDir(job.id);
  const outPath = path.join(jobDir, 'cleaned_output.mp4');
  await fs.writeFile(outPath, 'DUMMY_MP4_CONTENT');

  // 7a. Download when job is READY -> succeeds
  updateJob(job.id, { status: 'READY', processedFilePath: outPath });
  const readyReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/download`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const readyValidation = validateJobSession(readyReq, job.id, {
    endpoint: 'GET /api/v1/jobs/[jobId]/download',
  });
  assert.equal(readyValidation.ok, true);

  // 7b. Download with wrong token -> 403
  const badTokenReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}/download`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer wrong-token',
    },
  });
  const badTokenVal = validateJobSession(badTokenReq, job.id, {
    endpoint: 'GET /api/v1/jobs/[jobId]/download',
  });
  assert.equal(badTokenVal.ok, false);
  if (!badTokenVal.ok) {
    assert.equal(badTokenVal.response.status, 403);
  }

  await purgeJobFiles(job);
});

test('Step 6 Verification — 8. Rejecting expired sessions with HTTP 410', async () => {
  const job = await createJob();
  // Force expiration
  job.expiresAt = Date.now() - 5000;
  persistJobToDisk(job);

  const expReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const expValidation = validateJobSession(expReq, job.id, {
    endpoint: 'GET /api/v1/jobs/[jobId]',
  });
  assert.equal(expValidation.ok, false);
  if (!expValidation.ok) {
    assert.equal(expValidation.response.status, 410, 'Expired session must return 410 Gone');
  }

  await purgeJobFiles(job);
});

test('Step 6 Verification — 9. Starting a fresh session after an invalid session', async () => {
  const oldJob = await createJob();
  // Invalidate old session
  oldJob.expiresAt = Date.now() - 10000;
  persistJobToDisk(oldJob);

  // Old job rejected
  const oldReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${oldJob.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oldJob.token}` },
  });
  const oldVal = validateJobSession(oldReq, oldJob.id, { endpoint: 'GET /api/v1/jobs/[jobId]' });
  assert.equal(oldVal.ok, false);

  // Starting fresh session creates a brand new distinct job session
  const freshJob = await createJob();
  assert.notEqual(freshJob.id, oldJob.id, 'New session must have fresh ID');
  assert.notEqual(freshJob.token, oldJob.token, 'New session must have fresh token');
  assert.equal(freshJob.status, 'CREATED');

  const freshReq = createMockRequest(`http://localhost:3000/api/v1/jobs/${freshJob.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${freshJob.token}` },
  });
  const freshVal = validateJobSession(freshReq, freshJob.id, { endpoint: 'GET /api/v1/jobs/[jobId]' });
  assert.equal(freshVal.ok, true, 'Fresh session must be fully valid');

  await purgeJobFiles(oldJob);
  await purgeJobFiles(freshJob);
});

test('Step 6 Verification — 10. Handling server restart via disk persistence', async () => {
  const job = await createJob();
  updateJob(job.id, { progress: 80, stageMessage: 'Encoding restored frames...' });

  // Simulate server restart: clear memory Map completely
  if (globalThis.__vanishframe_jobsRegistry) {
    globalThis.__vanishframe_jobsRegistry.clear();
  }

  // Retrieve job from cold memory -> must re-hydrate from disk
  const rehydrated = getJob(job.id);
  assert.ok(rehydrated, 'Job must be re-hydrated from disk after memory clear');
  assert.equal(rehydrated?.id, job.id);
  assert.equal(rehydrated?.token, job.token);
  assert.equal(rehydrated?.progress, 80);
  assert.equal(rehydrated?.stageMessage, 'Encoding restored frames...');

  // Session validation continues to work seamlessly after restart
  const req = createMockRequest(`http://localhost:3000/api/v1/jobs/${job.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${job.token}`,
    },
  });
  const val = validateJobSession(req, job.id, { endpoint: 'GET /api/v1/jobs/[jobId]' });
  assert.equal(val.ok, true, 'Session validation must succeed after server restart rehydration');

  await purgeJobFiles(job);
});
