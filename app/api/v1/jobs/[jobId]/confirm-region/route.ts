import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob, verifyJobToken } from '@/lib/job-store';
import { clampRegion } from '@/lib/ffmpeg-runner';
import type { ProcessingMethod, WatermarkRegion } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const token = req.headers.get('x-job-token') || req.nextUrl.searchParams.get('token');

    const job = getJob(jobId);
    if (!job || !verifyJobToken(job, token)) {
      return NextResponse.json({ error: 'Unauthorized or invalid job session' }, { status: 403 });
    }

    if (!job.metadata) {
      return NextResponse.json({ error: 'Video metadata missing' }, { status: 400 });
    }

    const body = await req.json();
    const inputRegion = body.region as WatermarkRegion;
    const method = (body.method as ProcessingMethod) || 'delogo-interpolated';

    if (!inputRegion || typeof inputRegion.x !== 'number') {
      return NextResponse.json({ error: 'Invalid region coordinates provided' }, { status: 400 });
    }

    const clamped = clampRegion(inputRegion, job.metadata.width, job.metadata.height);

    updateJob(jobId, {
      status: 'QUEUED',
      progress: 45,
      stageMessage: 'Region confirmed. Queued for frame reconstruction.',
      confirmedRegion: clamped,
      processingMethod: method,
    });

    return NextResponse.json({
      success: true,
      confirmedRegion: clamped,
      method,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Region confirmation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
