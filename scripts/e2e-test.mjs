import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runE2ETest() {
  console.log('--- Starting End-to-End Workflow Verification ---');

  // 1. Prepare small test video using ffmpeg
  const testVideoPath = path.resolve('test_input_watermark.mp4');
  console.log('1. Generating real test video with synthetic watermark at:', testVideoPath);
  
  // 3-second test video with testsrc, sine audio, and a drawbox/drawtext watermark in the corner
  const ffmpegCmd = 'ffmpeg';
  const ffmpegArgs = [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=3:size=640x360:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:duration=3',
    '-vf', 'drawbox=x=450:y=20:w=160:h=40:color=white@0.8:t=fill',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    testVideoPath,
  ];

  await execFileAsync(ffmpegCmd, ffmpegArgs);
  const inputStat = await fs.stat(testVideoPath);
  console.log(`✓ Test video generated (${inputStat.size} bytes)`);

  // 2. Initialize job session
  console.log('2. Requesting new job session from POST /api/v1/jobs...');
  const initRes = await fetch('http://localhost:3000/api/v1/jobs', { method: 'POST' });
  if (!initRes.ok) throw new Error(`Job creation failed: ${initRes.status}`);
  const session = await initRes.json();
  console.log('✓ Session initialized:', {
    jobId: session.jobId,
    tokenPrefix: session.token?.slice(0, 8) + '...',
    expiresAt: session.expiresAt,
  });

  const { jobId, token } = session;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'x-job-token': token,
  };

  // 3. Upload video to the session
  console.log('3. Uploading video via POST /api/v1/jobs/[jobId]/upload...');
  const fileBuffer = await fs.readFile(testVideoPath);
  const formData = new FormData();
  const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' });
  formData.append('video', fileBlob, 'test_input_watermark.mp4');

  const uploadRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Upload failed (${uploadRes.status}): ${err}`);
  }
  const uploadData = await uploadRes.json();
  console.log('✓ Video uploaded and analyzed:', {
    width: uploadData.metadata?.width,
    height: uploadData.metadata?.height,
    duration: uploadData.metadata?.duration,
    detectedRegion: uploadData.detectedRegion,
    canAutoProcess: uploadData.canAutoProcess,
  });

  // 4. Confirm watermark region
  console.log('4. Confirming watermark bounding box via POST /api/v1/jobs/[jobId]/confirm-region...');
  const targetRegion = uploadData.detectedRegion || {
    x: 450,
    y: 20,
    width: 160,
    height: 40,
    confidence: 0.9,
    label: 'Watermark',
  };

  const confirmRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/confirm-region`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      region: targetRegion,
      method: 'delogo-interpolated',
    }),
  });

  if (!confirmRes.ok) {
    throw new Error(`Confirm region failed: ${confirmRes.status}`);
  }
  const confirmData = await confirmRes.json();
  console.log('✓ Region confirmed:', confirmData.confirmedRegion);

  // 5. Trigger video processing and wait for reconstruction result
  console.log('5. Executing reconstruction engine via POST /api/v1/jobs/[jobId]/process?wait=true...');
  const procRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/process?wait=true`, {
    method: 'POST',
    headers: authHeaders,
  });

  if (!procRes.ok) {
    const err = await procRes.text();
    throw new Error(`Processing failed (${procRes.status}): ${err}`);
  }
  const procData = await procRes.json();
  console.log('✓ Processing completed:', {
    status: procData.status,
    qualityReport: procData.qualityReport,
  });

  // 6. Poll status to verify final READY state
  console.log('6. Polling job status via GET /api/v1/jobs/[jobId]...');
  const statusRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}`, {
    headers: authHeaders,
  });
  if (!statusRes.ok) throw new Error(`Status polling failed: ${statusRes.status}`);
  const statusData = await statusRes.json();
  console.log('✓ Job status verified:', {
    status: statusData.status,
    progress: statusData.progress,
    stageMessage: statusData.stageMessage,
    hasProcessedVideo: statusData.hasProcessedVideo,
  });

  if (statusData.status !== 'READY') {
    throw new Error(`Expected status READY but got ${statusData.status}`);
  }

  // 7. Verify Result API endpoint
  console.log('7. Fetching result metadata via GET /api/v1/jobs/[jobId]/result...');
  const resultRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/result`, {
    headers: authHeaders,
  });
  if (!resultRes.ok) throw new Error(`Result failed: ${resultRes.status}`);
  const resultData = await resultRes.json();
  console.log('✓ Result endpoint verified:', {
    downloadUrl: resultData.downloadUrl,
    previewUrl: resultData.previewUrl,
  });

  // 8. Download processed video file
  console.log('8. Downloading reconstructed output via GET /api/v1/jobs/[jobId]/download...');
  const downloadRes = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/download`, {
    headers: authHeaders,
  });

  if (!downloadRes.ok) {
    throw new Error(`Download failed (${downloadRes.status})`);
  }

  const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const downloadedPath = path.resolve('test_output_cleaned.mp4');
  await fs.writeFile(downloadedPath, downloadedBuffer);
  console.log(`✓ Processed video downloaded (${downloadedBuffer.length} bytes) to: ${downloadedPath}`);

  if (downloadedBuffer.length === 0) {
    throw new Error('Downloaded file is empty (0 bytes)');
  }

  // 9. Inspect downloaded video with ffprobe
  console.log('9. Validating output video with ffprobe...');
  const { stdout: probeStdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=width,height,codec_name:format=duration,size',
    '-of', 'json',
    downloadedPath,
  ]);
  const probeData = JSON.parse(probeStdout);
  const outStream = probeData.streams?.[0];
  console.log('✓ Output video verified with ffprobe:', {
    width: outStream?.width,
    height: outStream?.height,
    codec: outStream?.codec_name,
    duration: probeData.format?.duration,
    size: probeData.format?.size,
  });

  if (outStream?.width !== 640 || outStream?.height !== 360) {
    throw new Error(`Expected resolution 640x360, got ${outStream?.width}x${outStream?.height}`);
  }

  // 10. Clean up test files
  await fs.unlink(testVideoPath).catch(() => {});
  await fs.unlink(downloadedPath).catch(() => {});
  console.log('✓ Cleaned up local temporary files');
  console.log('=== END-TO-END VERIFICATION PASSED SUCCESSFULLY ===');
}

runE2ETest().catch((err) => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
