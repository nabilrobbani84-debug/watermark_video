import { NextRequest, NextResponse } from 'next/server';
import { getJobDir, updateJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';
import { analyzeVideoForWatermark } from '@/lib/ffmpeg-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'POST /api/v1/jobs/[jobId]/analyze',
    allowedStatuses: ['AWAITING_CONFIRMATION', 'QUEUED', 'FAILED', 'READY'],
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job, correlationId } = validation;

  try {
    if (!job.originalFilePath || !job.metadata) {
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/analyze',
        jobId,
        jobState: job.status,
        errorCategory: 'INVALID_STATE',
        httpStatus: 400,
        message: 'No video file available for re-analysis',
      });
      return NextResponse.json({ error: 'No video file available for analysis' }, { status: 400 });
    }

    const jobDir = getJobDir(jobId);
    updateJob(jobId, {
      status: 'ANALYZING',
      progress: 30,
      stageMessage: 'Re-analyzing temporal frame variance for watermark candidates...',
    });

    const detectedRegion = await analyzeVideoForWatermark(job.originalFilePath, job.metadata, jobDir);

    updateJob(jobId, {
      status: 'AWAITING_CONFIRMATION',
      progress: 40,
      stageMessage: detectedRegion.canAutoProcess
        ? `Watermark candidate identified (${Math.round(detectedRegion.confidence * 100)}% confidence).`
        : `Candidate region identified. Manual confirmation recommended.`,
      detectedRegion,
      confirmedRegion: detectedRegion,
      canAutoProcess: detectedRegion.canAutoProcess,
    });

    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/analyze',
      jobId,
      jobState: 'AWAITING_CONFIRMATION',
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Video re-analysis completed',
    });

    return NextResponse.json({
      success: true,
      metadata: job.metadata,
      detectedRegion,
      canAutoProcess: detectedRegion.canAutoProcess,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/analyze',
      jobId,
      errorCategory: 'FFMPEG_ERROR',
      httpStatus: 500,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
