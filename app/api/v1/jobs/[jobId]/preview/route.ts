import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { getJob, isSafePath } from '@/lib/job-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
  }

  const type = req.nextUrl.searchParams.get('type') || 'original';

  let filePath: string | undefined;
  let contentType = 'video/mp4';

  if (type === 'frame') {
    filePath = job.previewThumbnailPath;
    contentType = 'image/jpeg';
  } else if (type === 'processed') {
    filePath = job.processedFilePath;
    contentType = 'video/mp4';
  } else {
    filePath = job.originalFilePath;
    contentType = 'video/mp4';
  }

  if (!filePath || !isSafePath(filePath)) {
    return NextResponse.json({ error: 'Requested media not ready or unavailable' }, { status: 404 });
  }

  try {
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    // Handle range request for video seeking
    const range = req.headers.get('range');
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Full file response
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error reading preview file';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
