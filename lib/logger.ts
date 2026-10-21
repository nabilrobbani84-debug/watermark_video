import path from 'node:path';
import type { JobStatus } from './types.ts';

export type ErrorCategory =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'JOB_NOT_FOUND'
  | 'JOB_EXPIRED'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'FFMPEG_ERROR'
  | 'INTERNAL_ERROR'
  | 'SUCCESS';

export interface DiagnosticLogPayload {
  correlationId: string;
  endpoint: string;
  jobId?: string;
  jobState?: JobStatus;
  errorCategory: ErrorCategory;
  httpStatus: number;
  message?: string;
  errorDetail?: string;
}

/**
 * Sanitizes strings to ensure private filesystem paths and potential tokens are never leaked into logs.
 */
function sanitizeLogString(str?: string): string | undefined {
  if (!str) return undefined;
  // Replace absolute Windows or Unix paths with sanitized base filenames
  let sanitized = str.replace(/(?:[a-zA-Z]:[\\/]|(?:\/[a-zA-Z0-9._-]+)+)[\\/]([a-zA-Z0-9._-]+)/g, '[path]/$1');
  // Redact potential 48-64 hex character session tokens if accidentally in error strings
  sanitized = sanitized.replace(/[a-f0-9]{48,64}/gi, '[REDACTED_TOKEN]');
  // Truncate excessively long strings
  return sanitized.length > 500 ? sanitized.slice(0, 500) + '...' : sanitized;
}

/**
 * Structured server-side diagnostic logging.
 * Logs in standardized JSON format for server observability.
 * Never logs session tokens, video contents, or private paths.
 */
export function logDiagnostic(payload: DiagnosticLogPayload): void {
  const sanitizedEntry = {
    timestamp: new Date().toISOString(),
    correlationId: payload.correlationId,
    endpoint: payload.endpoint,
    jobId: payload.jobId,
    jobState: payload.jobState,
    errorCategory: payload.errorCategory,
    httpStatus: payload.httpStatus,
    message: sanitizeLogString(payload.message),
    errorDetail: sanitizeLogString(payload.errorDetail),
  };

  const formatted = JSON.stringify(sanitizedEntry);
  if (payload.httpStatus >= 500) {
    console.error(`[DIAGNOSTIC_LOG] ${formatted}`);
  } else if (payload.httpStatus >= 400) {
    console.warn(`[DIAGNOSTIC_LOG] ${formatted}`);
  } else {
    console.info(`[DIAGNOSTIC_LOG] ${formatted}`);
  }
}
