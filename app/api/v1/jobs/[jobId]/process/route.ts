import { NextRequest, NextResponse } from 'next/server';
import { updateJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';
import { processVideoJob } from '@/lib/ffmpeg-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'POST /api/v1/jobs/[jobId]/process',
    allowedStatuses: ['QUEUED', 'AWAITING_CONFIRMATION', 'FAILED', 'PROCESSING', 'VERIFYING'],
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job, correlationId } = validation;

  // Prevent duplicate concurrent execution
  if (job.status === 'PROCESSING' || job.status === 'VERIFYING') {
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/process',
      jobId,
      jobState: job.status,
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Job is already actively processing',
    });
    return NextResponse.json(
      {
        message: 'Job is already actively processing',
        status: job.status,
        progress: job.progress,
      },
      { status: 200 }
    );
  }

  if (!job.confirmedRegion || !job.metadata || !job.originalFilePath) {
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/process',
      jobId,
      jobState: job.status,
      errorCategory: 'INVALID_STATE',
      httpStatus: 400,
      message: 'Cannot process video: missing confirmed region or video source',
    });
    return NextResponse.json(
      { error: 'Cannot process video: missing confirmed region or video source' },
      { status: 400 }
    );
  }

  updateJob(jobId, {
    status: 'PROCESSING',
    progress: 45,
    stageMessage: 'Starting video reconstruction pipeline...',
    error: undefined,
  });

  const shouldWait =
    req.headers.get('x-wait') === 'true' ||
    req.nextUrl.searchParams.get('wait') === 'true';

  const runProcessing = async () => {
    try {
      const { outputPath, qualityReport } = await processVideoJob(
        job,
        job.confirmedRegion!,
        job.processingMethod,
        (progress, stage) => {
          updateJob(jobId, { progress, stageMessage: stage });
        }
      );

      updateJob(jobId, {
        status: 'READY',
        progress: 100,
        stageMessage: 'Reconstruction completed and verified with ffprobe.',
        processedFilePath: outputPath,
        qualityReport,
      });

      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/process',
        jobId,
        jobState: 'READY',
        errorCategory: 'SUCCESS',
        httpStatus: 200,
        message: 'Video processing pipeline finished successfully',
      });

      return { outputPath, qualityReport };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed';
      updateJob(jobId, {
        status: 'FAILED',
        progress: 0,
        stageMessage: `Processing error: ${message}`,
        error: message,
      });
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/process',
        jobId,
        jobState: 'FAILED',
        errorCategory: 'FFMPEG_ERROR',
        httpStatus: 500,
        message,
      });
      throw error;
    }
  };

  if (shouldWait) {
    try {
      const result = await runProcessing();
      return NextResponse.json({
        success: true,
        status: 'READY',
        qualityReport: result.qualityReport,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Launch async and return immediately with 202 Accepted
  void runProcessing();

  logDiagnostic({
    correlationId,
    endpoint: 'POST /api/v1/jobs/[jobId]/process',
    jobId,
    jobState: 'PROCESSING',
    errorCategory: 'SUCCESS',
    httpStatus: 202,
    message: 'Video reconstruction job queued asynchronously',
  });

  return NextResponse.json(
    {
      success: true,
      status: 'PROCESSING',
      message: 'Video frame reconstruction started in background',
      jobId,
    },
    { status: 202 }
  );
}
