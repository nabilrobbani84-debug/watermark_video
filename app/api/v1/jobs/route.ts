import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createJob } from '@/lib/job-store';
import { logDiagnostic } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || randomUUID();
  try {
    const job = await createJob();
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs',
      jobId: job.id,
      jobState: job.status,
      errorCategory: 'SUCCESS',
      httpStatus: 201,
      message: 'Ephemeral job session initialized successfully',
    });
    return NextResponse.json(
      {
        jobId: job.id,
        token: job.token,
        sessionToken: job.token,
        expiresAt: job.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job';
    logDiagnostic({
      correlationId,
      endpoint: 'POST /api/v1/jobs',
      errorCategory: 'INTERNAL_ERROR',
      httpStatus: 500,
      message,
    });
    return NextResponse.json({ error: message, correlationId }, { status: 500 });
  }
}
