import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob, verifyJobToken } from '@/lib/job-store';
import { processVideoJob } from '@/lib/ffmpeg-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = req.headers.get('x-job-token') || req.nextUrl.searchParams.get('token');

  const job = getJob(jobId);
  if (!job || !verifyJobToken(job, token)) {
    return NextResponse.json({ error: 'Unauthorized or invalid job session' }, { status: 403 });
  }

  if (!job.confirmedRegion || !job.metadata || !job.originalFilePath) {
    return NextResponse.json(
      { error: 'Cannot process video: missing confirmed region or video source' },
      { status: 400 }
    );
  }

  // Prevent duplicate concurrent execution
  if (job.status === 'PROCESSING' || job.status === 'VERIFYING') {
    return NextResponse.json({ message: 'Job is already processing', status: job.status });
  }

  updateJob(jobId, {
    status: 'PROCESSING',
    progress: 50,
    stageMessage: 'Restoring video frames with reconstruction filter...',
  });

  try {
    const { outputPath, qualityReport } = await processVideoJob(
      job,
      job.confirmedRegion,
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

    return NextResponse.json({
      success: true,
      status: 'READY',
      qualityReport,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    updateJob(jobId, {
      status: 'FAILED',
      progress: 0,
      stageMessage: `Processing error: ${message}`,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
