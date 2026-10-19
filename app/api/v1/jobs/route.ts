import { NextResponse } from 'next/server';
import { createJob } from '@/lib/job-store';

export async function POST() {
  try {
    const job = await createJob();
    return NextResponse.json({
      jobId: job.id,
      token: job.token,
      expiresAt: job.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
