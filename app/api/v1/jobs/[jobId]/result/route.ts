import { NextRequest, NextResponse } from 'next/server';
import { validateJobSession } from '@/lib/job-session';

// Result route
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'GET /api/v1/jobs/[jobId]/result',
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job } = validation;
  const hasProcessedVideo = Boolean(job.processedFilePath && job.status === 'READY');

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stageMessage: job.stageMessage,
    hasProcessedVideo,
    // Protected URLs without tokens in query string
    downloadUrl: hasProcessedVideo ? `/api/v1/jobs/${job.id}/download` : null,
    previewUrl: hasProcessedVideo ? `/api/v1/jobs/${job.id}/preview?type=processed` : null,
    originalPreviewUrl: job.originalFilePath ? `/api/v1/jobs/${job.id}/preview?type=original` : null,
    qualityReport: job.qualityReport,
    metadata: job.metadata,
    error: job.error,
  });
}
