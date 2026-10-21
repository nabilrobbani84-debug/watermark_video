import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server.js';
import { getJob, verifyJobToken } from './job-store.ts';
import { logDiagnostic } from './logger.ts';
import type { Job, JobStatus } from './types.ts';

export interface ValidationSuccess {
  ok: true;
  job: Job;
  correlationId: string;
}

export interface ValidationFailure {
  ok: false;
  response: NextResponse;
  correlationId: string;
}

export type SessionValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Extracts session token from HTTP Authorization header (Bearer),
 * x-job-token header, or query parameters.
 */
export function extractSessionToken(req: Request | NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const xJobToken = req.headers.get('x-job-token');
  if (xJobToken) {
    return xJobToken.trim();
  }

  if ('nextUrl' in req && req.nextUrl.searchParams.has('token')) {
    return req.nextUrl.searchParams.get('token')?.trim() || null;
  }

  try {
    const parsedUrl = new URL(req.url);
    const tokenParam = parsedUrl.searchParams.get('token');
    if (tokenParam) {
      return tokenParam.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Validates a job session against the central job store according to
 * the unified session security contract.
 */
export function validateJobSession(
  req: NextRequest,
  jobId: string,
  options: {
    endpoint: string;
    allowedStatuses?: JobStatus[];
  }
): SessionValidationResult {
  const correlationId = req.headers.get('x-correlation-id') || randomUUID();
  const token = extractSessionToken(req);

  // 1. Verify job existence
  const job = getJob(jobId);
  if (!job) {
    logDiagnostic({
      correlationId,
      endpoint: options.endpoint,
      jobId,
      errorCategory: 'JOB_NOT_FOUND',
      httpStatus: 404,
      message: 'Job session not found or does not exist',
    });
    return {
      ok: false,
      correlationId,
      response: NextResponse.json(
        { error: 'Job session not found or expired', correlationId },
        { status: 404 }
      ),
    };
  }

  // 2. Verify expiration
  if (job.status === 'EXPIRED' || Date.now() > job.expiresAt) {
    logDiagnostic({
      correlationId,
      endpoint: options.endpoint,
      jobId,
      jobState: job.status,
      errorCategory: 'JOB_EXPIRED',
      httpStatus: 410,
      message: 'Job session expired. Ephemeral data purged.',
    });
    return {
      ok: false,
      correlationId,
      response: NextResponse.json(
        { error: 'Job session expired', correlationId },
        { status: 410 }
      ),
    };
  }

  // 3. Verify session token presence
  if (!token) {
    logDiagnostic({
      correlationId,
      endpoint: options.endpoint,
      jobId,
      jobState: job.status,
      errorCategory: 'AUTH_UNAUTHORIZED',
      httpStatus: 401,
      message: 'Missing authorization session token',
    });
    return {
      ok: false,
      correlationId,
      response: NextResponse.json(
        { error: 'Missing authorization token', correlationId },
        { status: 401 }
      ),
    };
  }

  // 4. Verify token match using timing-safe comparison
  const isAuthorized = verifyJobToken(job, token);
  if (!isAuthorized) {
    logDiagnostic({
      correlationId,
      endpoint: options.endpoint,
      jobId,
      jobState: job.status,
      errorCategory: 'AUTH_FORBIDDEN',
      httpStatus: 403,
      message: 'Unauthorized or invalid job session token',
    });
    return {
      ok: false,
      correlationId,
      response: NextResponse.json(
        { error: 'Unauthorized or invalid job session', correlationId },
        { status: 403 }
      ),
    };
  }

  // 5. Verify valid job state for requested operation
  if (options.allowedStatuses && !options.allowedStatuses.includes(job.status)) {
    logDiagnostic({
      correlationId,
      endpoint: options.endpoint,
      jobId,
      jobState: job.status,
      errorCategory: 'INVALID_STATE',
      httpStatus: 409,
      message: `Requested operation is not permitted for current job status: ${job.status}`,
    });
    return {
      ok: false,
      correlationId,
      response: NextResponse.json(
        {
          error: `Operation not allowed in current state (${job.status})`,
          currentStatus: job.status,
          correlationId,
        },
        { status: 409 }
      ),
    };
  }

  logDiagnostic({
    correlationId,
    endpoint: options.endpoint,
    jobId,
    jobState: job.status,
    errorCategory: 'SUCCESS',
    httpStatus: 200,
    message: 'Job session successfully validated',
  });

  return {
    ok: true,
    job,
    correlationId,
  };
}
