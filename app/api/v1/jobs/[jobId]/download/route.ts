import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { getJob, isSafePath, verifyJobToken } from '@/lib/job-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = req.headers.get('x-job-token') || req.nextUrl.searchParams.get('token');

  const job = getJob(jobId);
  if (!job || !verifyJobToken(job, token)) {
    return NextResponse.json({ error: 'Unauthorized or expired download link' }, { status: 403 });
  }

  if (job.status !== 'READY' || !job.processedFilePath) {
    return NextResponse.json({ error: 'Processed video is not ready for download' }, { status: 400 });
  }

  if (!isSafePath(job.processedFilePath)) {
    return NextResponse.json({ error: 'Invalid file target' }, { status: 403 });
  }

  try {
    const stat = await fs.stat(job.processedFilePath);
    const nodeStream = createReadStream(job.processedFilePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    const filename = `vanishframe_cleaned_${job.id.slice(0, 8)}.mp4`;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error serving download';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
