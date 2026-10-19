import test from 'node:test';
import assert from 'node:assert/strict';
import { clampRegion, detectCandidateWatermark } from './ffmpeg-runner.ts';
import { sanitizeFileName, isSafePath } from './job-store.ts';
import type { VideoMetadata } from './types.ts';

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
  assert.ok(br.confidence > 0.8, 'Should have high confidence');

  const tl = detectCandidateWatermark(meta, 'top-left');
  assert.ok(tl.x < 640, 'Should be in left half');
  assert.ok(tl.y < 360, 'Should be in top half');
});

test('sanitizeFileName removes dangerous characters and directory traversal', () => {
  assert.equal(sanitizeFileName('../../../etc/passwd'), '.._.._.._etc_passwd');
  assert.equal(sanitizeFileName('my video!#$ (1).mp4'), 'my_video_____1_.mp4');
  assert.equal(sanitizeFileName('clean_video.mov'), 'clean_video.mov');
});

test('isSafePath detects path traversal attempts', () => {
  assert.equal(isSafePath('/etc/passwd'), false);
  assert.equal(isSafePath('/var/log/syslog'), false);
});
