import { NextRequest, NextResponse } from 'next/server';
import { deleteJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'GET /api/v1/jobs/[jobId]',
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job } = validation;
  const now = Date.now();
  const secondsRemaining = Math.max(0, Math.round((job.expiresAt - now) / 1000));

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stageMessage: job.stageMessage,
    expiresAt: job.expiresAt,
    secondsRemaining,
    metadata: job.metadata,
    detectedRegion: job.detectedRegion,
    confirmedRegion: job.confirmedRegion,
    qualityReport: job.qualityReport,
    hasProcessedVideo: Boolean(job.processedFilePath && job.status === 'READY'),
    canAutoProcess: job.canAutoProcess,
    error: job.error,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'DELETE /api/v1/jobs/[jobId]',
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job } = validation;
  await deleteJob(jobId, job.token);

  return NextResponse.json({
    success: true,
    message: 'Job cancelled and ephemeral files purged',
  });
}
