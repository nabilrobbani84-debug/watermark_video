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
    endpoint: 'GET /api/v1/jobs/[jobId]/preview',
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job, correlationId } = validation;
  const type = req.nextUrl.searchParams.get('type') || 'original';

  let filePath: string | undefined;
  let contentType = 'video/mp4';

  if (type === 'frame') {
    filePath = job.previewThumbnailPath;
    contentType = 'image/jpeg';
  } else if (type === 'processed') {
    if (job.status !== 'READY' || !job.processedFilePath) {
      logDiagnostic({
        correlationId,
        endpoint: 'GET /api/v1/jobs/[jobId]/preview',
        jobId,
        jobState: job.status,
        errorCategory: 'INVALID_STATE',
        httpStatus: 400,
        message: 'Processed video preview is not ready yet',
      });
      return NextResponse.json(
        { error: 'Processed video is not ready yet' },
        { status: 400 }
      );
    }
    filePath = job.processedFilePath;
    contentType = 'video/mp4';
  } else {
    filePath = job.originalFilePath;
    contentType = 'video/mp4';
  }

  if (!filePath || !isSafePath(filePath)) {
    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/preview',
      jobId,
      jobState: job.status,
      errorCategory: 'JOB_NOT_FOUND',
      httpStatus: 404,
      message: 'Requested media target unavailable or invalid path',
    });
    return NextResponse.json(
      { error: 'Requested media target unavailable or invalid' },
      { status: 404 }
    );
  }

  try {
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    if (fileSize === 0) {
      logDiagnostic({
        correlationId,
        endpoint: 'GET /api/v1/jobs/[jobId]/preview',
        jobId,
        errorCategory: 'INTERNAL_ERROR',
        httpStatus: 500,
        message: 'Media preview file is empty',
      });
      return NextResponse.json({ error: 'Media file is empty' }, { status: 500 });
    }

    // Range request handling for video scrubbing and seeking
    const range = req.headers.get('range');
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
            'Content-Type': contentType,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    // Full stream response
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error serving preview file';
    logDiagnostic({
      correlationId,
      endpoint: 'GET /api/v1/jobs/[jobId]/preview',
      jobId,
      errorCategory: 'INTERNAL_ERROR',
      httpStatus: 500,
      message: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
