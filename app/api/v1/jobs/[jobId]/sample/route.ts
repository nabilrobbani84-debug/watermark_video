import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { getJobDir, updateJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';
import {
  analyzeVideoForWatermark,
  createSyntheticSampleVideo,
  extractPreviewFrame,
} from '@/lib/ffmpeg-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'POST /api/v1/jobs/[jobId]/sample',
    allowedStatuses: ['CREATED', 'FAILED'],
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { correlationId } = validation;

  try {
    const jobDir = getJobDir(jobId);
    const sampleFilePath = path.join(jobDir, 'sample_watermark_video.mp4');

    updateJob(jobId, {
      status: 'ANALYZING',
      progress: 25,
      stageMessage: 'Generating authenticated test video with overlay...',
      originalFileName: 'vanishframe_sample_test.mp4',
      originalFilePath: sampleFilePath,
    });

    const metadata = await createSyntheticSampleVideo(sampleFilePath);

    const previewFramePath = path.join(jobDir, 'preview_frame.jpg');
    try {
      await extractPreviewFrame(sampleFilePath, previewFramePath, 1.0);
    } catch {
      // ignore
    }

    const detectedRegion = await analyzeVideoForWatermark(sampleFilePath, metadata, jobDir);

    updateJob(jobId, {
      status: 'AWAITING_CONFIRMATION',
      progress: 40,
      stageMessage: 'Candidate region detected on sample video. Ready for processing.',
      metadata,
      detectedRegion,
      confirmedRegion: detectedRegion,
      previewThumbnailPath: previewFramePath,
      canAutoProcess: detectedRegion.canAutoProcess,
    });

    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/sample',
      jobId,
      jobState: 'AWAITING_CONFIRMATION',
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Synthetic sample video created and analyzed',
    });

    return NextResponse.json({
      success: true,
      metadata,
      detectedRegion,
      canAutoProcess: detectedRegion.canAutoProcess,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sample generation failed';
    updateJob(jobId, {
      status: 'FAILED',
      progress: 0,
      stageMessage: `Sample generation failed: ${message}`,
      error: message,
    });
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/sample',
      jobId,
      errorCategory: 'FFMPEG_ERROR',
      httpStatus: 500,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
