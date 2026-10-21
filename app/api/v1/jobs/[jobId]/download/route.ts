import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { isSafePath } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'GET /api/v1/jobs/[jobId]/download',
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job, correlationId } = validation;

  if (job.status !== 'READY' || !job.processedFilePath) {
    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/download',
      jobId,
      jobState: job.status,
      errorCategory: 'INVALID_STATE',
      httpStatus: 400,
      message: 'Processed video is not ready for download yet',
    });
    return NextResponse.json(
      { error: 'Processed video is not ready for download yet' },
      { status: 400 }
    );
  }

  if (!isSafePath(job.processedFilePath)) {
    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/download',
      jobId,
      jobState: job.status,
      errorCategory: 'AUTH_FORBIDDEN',
      httpStatus: 403,
      message: 'Path traversal attempt rejected',
    });
    return NextResponse.json({ error: 'Invalid file path traversal attempt' }, { status: 403 });
  }

  try {
    const stat = await fs.stat(job.processedFilePath);
    if (stat.size === 0) {
      logDiagnostic({
        correlationId,
        endpoint: 'GET /api/v1/jobs/[jobId]/download',
        jobId,
        jobState: job.status,
        errorCategory: 'INTERNAL_ERROR',
        httpStatus: 500,
        message: 'Processed video file is empty',
      });
      return NextResponse.json({ error: 'Processed video file is empty' }, { status: 500 });
    }

    const nodeStream = createReadStream(job.processedFilePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    const baseName = job.originalFileName
      ? `vanishframe_cleaned_${job.originalFileName.replace(/\.[^/.]+$/, '')}.mp4`
      : `vanishframe_cleaned_${job.id.slice(0, 8)}.mp4`;

    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/download',
      jobId,
      jobState: job.status,
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Processed video download stream started',
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error serving download file';
    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/download',
      jobId,
      errorCategory: 'INTERNAL_ERROR',
      httpStatus: 500,
      message: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
