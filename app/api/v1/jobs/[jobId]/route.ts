import { NextRequest, NextResponse } from 'next/server';
import { deleteJob, getJob, verifyJobToken } from '@/lib/job-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

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
    hasProcessedVideo: Boolean(job.processedFilePath),
    error: job.error,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = req.headers.get('x-job-token') || req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const job = getJob(jobId);
  if (!job || !verifyJobToken(job, token)) {
    return NextResponse.json({ error: 'Invalid or unauthorized job' }, { status: 403 });
  }

  await deleteJob(jobId, token);
  return NextResponse.json({ success: true, message: 'Job cancelled and files purged' });
}
