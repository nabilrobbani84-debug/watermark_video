import { NextRequest, NextResponse } from 'next/server';
import { updateJob } from '@/lib/job-store';
import { validateJobSession } from '@/lib/job-session';
import { logDiagnostic } from '@/lib/logger';
import { clampRegion } from '@/lib/ffmpeg-runner';
import type { ProcessingMethod, WatermarkRegion } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const validation = validateJobSession(req, jobId, {
    endpoint: 'POST /api/v1/jobs/[jobId]/confirm-region',
    allowedStatuses: ['AWAITING_CONFIRMATION', 'QUEUED', 'FAILED'],
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { job, correlationId } = validation;

  try {
    if (!job.metadata) {
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/confirm-region',
        jobId,
        jobState: job.status,
        errorCategory: 'INVALID_STATE',
        httpStatus: 400,
        message: 'Video metadata missing before confirmation',
      });
      return NextResponse.json({ error: 'Video metadata missing' }, { status: 400 });
    }

    const body = await req.json();
    const inputRegion = body.region as WatermarkRegion;
    const method = (body.method as ProcessingMethod) || 'delogo-interpolated';

    if (!inputRegion || typeof inputRegion.x !== 'number') {
      logDiagnostic({
        correlationId,
        endpoint: 'POST /api/v1/jobs/[jobId]/confirm-region',
        jobId,
        jobState: job.status,
        errorCategory: 'INVALID_INPUT',
        httpStatus: 400,
        message: 'Invalid region coordinates provided in payload',
      });
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

    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/confirm-region',
      jobId,
      jobState: 'QUEUED',
      errorCategory: 'SUCCESS',
      httpStatus: 200,
      message: 'Region coordinates confirmed and clamped to stream boundaries',
    });

    return NextResponse.json({
      success: true,
      confirmedRegion: clamped,
      method,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Region confirmation failed';
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs/[jobId]/confirm-region',
      jobId,
      errorCategory: 'INTERNAL_ERROR',
      httpStatus: 500,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
