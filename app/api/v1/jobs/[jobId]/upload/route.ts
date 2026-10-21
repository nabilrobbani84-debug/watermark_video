import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getJobDir, sanitizeFileName, updateJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';
import {
  analyzeVideoForWatermark,
  extractPreviewFrame,
  probeVideo,
} from '@/lib/ffmpeg-runner';

// Max file size: 200MB
const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'POST /api/v1/jobs/[jobId]/upload',
    allowedStatuses: ['CREATED', 'UPLOADING', 'FAILED'],
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { correlationId } = validation;

  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/upload',
        jobId,
        jobState: validation.job.status,
        errorCategory: 'INVALID_INPUT',
        httpStatus: 400,
        message: 'No video file provided in form data',
      });
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/upload',
        jobId,
        jobState: validation.job.status,
        errorCategory: 'INVALID_INPUT',
        httpStatus: 413,
        message: 'File exceeds 200MB maximum size limit',
      });
      return NextResponse.json(
        { error: 'File exceeds maximum upload size of 200MB' },
        { status: 413 }
      );
    }

    const jobDir = getJobDir(jobId);
    const safeName = sanitizeFileName(file.name || 'uploaded_video.mp4');
    const targetFilePath = path.join(jobDir, `orig_${safeName}`);

    // Stream / buffer file to disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(targetFilePath, Buffer.from(arrayBuffer));

    updateJob(jobId, {
      status: 'ANALYZING',
      progress: 20,
      stageMessage: 'Analyzing media stream metadata and temporal variance with FFmpeg...',
      originalFileName: file.name,
      originalFilePath: targetFilePath,
    });

    // Probe video with ffprobe
    const metadata = await probeVideo(targetFilePath);

    // Extract reference frame for user visualization
    const previewFramePath = path.join(jobDir, 'preview_frame.jpg');
    try {
      await extractPreviewFrame(targetFilePath, previewFramePath, Math.min(1.0, metadata.duration / 2));
    } catch {
      // Ignore preview frame extraction failure if video is very short
    }

    // Genuine multi-frame temporal variance analysis
    const detectedRegion = await analyzeVideoForWatermark(targetFilePath, metadata, jobDir);

    updateJob(jobId, {
      status: 'AWAITING_CONFIRMATION',
      progress: 35,
      stageMessage: detectedRegion.canAutoProcess
        ? `Watermark candidate identified with high confidence (${Math.round(detectedRegion.confidence * 100)}%). Ready to restore.`
        : `Candidate region identified. Please confirm or adjust coordinates.`,
      metadata,
      detectedRegion,
      confirmedRegion: detectedRegion,
      previewThumbnailPath: previewFramePath,
      canAutoProcess: detectedRegion.canAutoProcess,
    });

    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/upload',
      jobId,
      jobState: 'AWAITING_CONFIRMATION',
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Video uploaded and analyzed successfully',
    });

    return NextResponse.json({
      success: true,
      metadata,
      detectedRegion,
      canAutoProcess: detectedRegion.canAutoProcess,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    updateJob(jobId, {
      status: 'FAILED',
      progress: 0,
      stageMessage: `Analysis error: ${message}`,
      error: message,
    });
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/upload',
      jobId,
      errorCategory: 'FFMPEG_ERROR',
      httpStatus: 500,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
