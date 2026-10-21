import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  analyzeVideoForWatermark,
  clampRegion,
  createSyntheticSampleVideo,
  detectCandidateWatermark,
  getFfmpegPath,
  getFfprobePath,
  probeVideo,
  processVideoJob,
} from './ffmpeg-runner.ts';
import {
  createJob,
  deleteJob,
  getJob,
  getJobDir,
  isSafePath,
  purgeJobFiles,
  sanitizeFileName,
  updateJob,
  verifyJobToken,
} from './job-store.ts';
import type { VideoMetadata, WatermarkRegion } from './types.ts';

test('clampRegion keeps bounding box within video boundaries', () => {
  const videoWidth = 1920;
  const videoHeight = 1080;

  // Normal box
  const normal = clampRegion(
    { x: 100, y: 100, width: 200, height: 100, confidence: 0.9, label: 'Custom' },
    videoWidth,
    videoHeight,
  );
  assert.equal(normal.x, 100);
  assert.equal(normal.y, 100);
  assert.equal(normal.width, 200);
  assert.equal(normal.height, 100);

  // Box overflowing right and bottom
  const overflow = clampRegion(
    { x: 1900, y: 1050, width: 300, height: 200, confidence: 0.8, label: 'Overflow' },
    videoWidth,
    videoHeight,
  );
  assert.ok(overflow.x + overflow.width <= videoWidth);
  assert.ok(overflow.y + overflow.height <= videoHeight);
  assert.ok(overflow.x >= 0);
  assert.ok(overflow.y >= 0);

  // Negative coordinates
  const negative = clampRegion(
    { x: -50, y: -20, width: 100, height: 80, confidence: 0.85, label: 'Neg' },
    videoWidth,
    videoHeight,
  );
  assert.equal(negative.x, 0);
  assert.equal(negative.y, 0);
});

test('detectCandidateWatermark positions in target corner correctly', () => {
  const meta: VideoMetadata = {
    filename: 'test.mp4',
    duration: 10,
    width: 1280,
    height: 720,
    fps: 30,
    codec: 'h264',
    size: 2000000,
    hasAudio: true,
  };

  const br = detectCandidateWatermark(meta, 'bottom-right');
  assert.ok(br.x > 640, 'Should be in right half');
  assert.ok(br.y > 360, 'Should be in bottom half');
  assert.ok(br.confidence >= 0.8, 'Should have high confidence');

  const tl = detectCandidateWatermark(meta, 'top-left');
  assert.ok(tl.x < 640, 'Should be in left half');
  assert.ok(tl.y < 360, 'Should be in top half');
});

test('sanitizeFileName removes dangerous characters and directory traversal', () => {
  assert.equal(sanitizeFileName('../../../etc/passwd'), '.._.._.._etc_passwd');
  assert.equal(sanitizeFileName('my video!#$ (1).mp4'), 'my_video_____1_.mp4');
  assert.equal(sanitizeFileName('clean_video.mov'), 'clean_video.mov');
  assert.equal(sanitizeFileName(''), 'video.mp4');
});

test('isSafePath detects path traversal attempts', () => {
  assert.equal(isSafePath('/etc/passwd'), false);
  assert.equal(isSafePath('C:\\Windows\\System32\\cmd.exe'), false);
  assert.equal(isSafePath(''), false);
});

test('Job Store lifecycle: create, verify token, update, and cancel', async () => {
  const job = await createJob();
  assert.ok(job.id, 'Job should have unique id');
  assert.ok(job.token, 'Job should have secure token');
  assert.equal(job.status, 'CREATED');

  // Verify valid token
  assert.equal(verifyJobToken(job, job.token), true);
  assert.equal(verifyJobToken(job, 'wrong-token'), false);
  assert.equal(verifyJobToken(job, null), false);

  // Update job
  const updated = updateJob(job.id, { progress: 50, stageMessage: 'Test stage' });
  assert.equal(updated?.progress, 50);

  // Cancellation
  const cancelled = await deleteJob(job.id, job.token);
  assert.equal(cancelled, true);

  // Confirm job is gone from registry
  const fetched = getJob(job.id);
  assert.equal(fetched, undefined);
});

test('Job Store expiration: marks job EXPIRED when time exceeded', async () => {
  const job = await createJob();
  job.expiresAt = Date.now() - 1000; // Force expired
  const fetched = getJob(job.id);
  assert.equal(fetched?.status, 'EXPIRED');
});

test('FFmpeg & FFprobe executable resolution', async () => {
  const ffmpeg = await getFfmpegPath();
  const ffprobe = await getFfprobePath();

  assert.ok(ffmpeg, 'ffmpeg binary path must resolve');
  assert.ok(ffprobe, 'ffprobe binary path must resolve');
});

test('End-to-End Video Processing Pipeline: Synthetic Generation -> Variance Detection -> Reconstruction -> Verification', async () => {
  const job = await createJob();
  const jobDir = getJobDir(job.id);
  const samplePath = path.join(jobDir, 'synth_test.mp4');

  // 1. Generate real synthetic video
  const metadata = await createSyntheticSampleVideo(samplePath);
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
  assert.ok(metadata.duration >= 3.0);
  assert.equal(metadata.hasAudio, true);

  // 2. Perform genuine multi-frame temporal variance detection
  const detectedRegion = await analyzeVideoForWatermark(samplePath, metadata, jobDir);
  assert.ok(detectedRegion.width > 0);
  assert.ok(detectedRegion.height > 0);
  assert.ok(detectedRegion.confidence > 0);
  assert.ok(detectedRegion.label);

  // 3. Process video with delogo reconstruction filter
  updateJob(job.id, {
    originalFilePath: samplePath,
    metadata,
    confirmedRegion: detectedRegion,
    processingMethod: 'delogo-interpolated',
  });

  const { outputPath, qualityReport } = await processVideoJob(
    job,
    detectedRegion,
    'delogo-interpolated',
  );

  // 4. Verify output file existence and properties
  const stat = await fs.stat(outputPath);
  assert.ok(stat.size > 10000, 'Output video size must be greater than 10KB');

  // 5. Verify quality report
  assert.equal(qualityReport.resolutionPreserved, true);
  assert.equal(qualityReport.outputResolution, '1280x720');
  assert.equal(qualityReport.audioPreserved, true);
  assert.equal(qualityReport.videoReencoded, true);
  assert.ok(qualityReport.notes.length > 0);

  // 6. Verify probe on output video
  const outProbe = await probeVideo(outputPath);
  assert.equal(outProbe.width, 1280);
  assert.equal(outProbe.height, 720);
  assert.equal(outProbe.hasAudio, true);

  // 7. Cleanup
  await purgeJobFiles(job);
  const exists = await fs.stat(jobDir).catch(() => null);
  assert.equal(exists, null, 'Job directory should be completely purged');
});

test('Corrupted input file handling in probeVideo', async () => {
  const job = await createJob();
  const jobDir = getJobDir(job.id);
  const fakeFile = path.join(jobDir, 'corrupted.mp4');
  await fs.writeFile(fakeFile, 'THIS_IS_NOT_A_VALID_VIDEO_STREAM');

  await assert.rejects(
    async () => {
      await probeVideo(fakeFile);
    },
    /No valid video stream/i,
  );

  await purgeJobFiles(job);
});
