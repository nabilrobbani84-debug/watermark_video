import type {
  CreateJobResponse,
  JobResultResponse,
  JobStatusResponse,
  ProcessingMethod,
  VideoMetadata,
  WatermarkRegion,
} from './types.ts';

export class ApiError extends Error {
  public status: number;
  public correlationId?: string;
  public isAuthError: boolean;
  public isExpired: boolean;
  public isNotFound: boolean;

  constructor(message: string, status: number, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.correlationId = correlationId;
    this.isAuthError = status === 401 || status === 403;
    this.isExpired = status === 410;
    this.isNotFound = status === 404;
  }
}

/**
 * Standard headers helper ensuring consistent session token delivery across all endpoints.
 */
function createAuthHeaders(token?: string, extraHeaders?: Record<string, string>): Headers {
  const headers = new Headers(extraHeaders);
  if (token) {
    const cleanToken = token.trim();
    headers.set('Authorization', `Bearer ${cleanToken}`);
    headers.set('x-job-token', cleanToken);
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed (HTTP ${res.status})`;
    let correlationId: string | undefined;
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
      correlationId = data.correlationId;
    } catch {
      // Body not JSON
    }
    throw new ApiError(errorMsg, res.status, correlationId);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  /**
   * Initializes a secure ephemeral job session.
   */
  async createJobSession(): Promise<CreateJobResponse> {
    const res = await fetch('/api/v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<CreateJobResponse>(res);
  },

  /**
   * Fetches latest job status for polling.
   */
  async getJobStatus(jobId: string, token: string): Promise<JobStatusResponse> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    });
    return handleResponse<JobStatusResponse>(res);
  },

  /**
   * Uploads user video file into the authorized session.
   */
  async uploadVideo(
    jobId: string,
    token: string,
    file: File
  ): Promise<{
    success: boolean;
    metadata: VideoMetadata;
    detectedRegion: WatermarkRegion;
    canAutoProcess?: boolean;
  }> {
    const formData = new FormData();
    formData.append('video', file);

    const headers = createAuthHeaders(token);
    // Note: Do not set Content-Type header manually for FormData so boundary is generated

    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  /**
   * Generates synthetic sample video for testing in the authorized session.
   */
  async createSampleVideo(
    jobId: string,
    token: string
  ): Promise<{
    success: boolean;
    metadata: VideoMetadata;
    detectedRegion: WatermarkRegion;
    canAutoProcess?: boolean;
  }> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/sample`, {
      method: 'POST',
      headers: createAuthHeaders(token),
    });
    return handleResponse(res);
  },

  /**
   * Confirms watermark region coordinates and reconstruction algorithm.
   */
  async confirmRegion(
    jobId: string,
    token: string,
    region: WatermarkRegion,
    method: ProcessingMethod
  ): Promise<{ success: boolean; confirmedRegion: WatermarkRegion; method: ProcessingMethod }> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/confirm-region`, {
      method: 'POST',
      headers: createAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ region, method }),
    });
    return handleResponse(res);
  },

  /**
   * Triggers video reconstruction in background.
   */
  async startProcessing(jobId: string, token: string): Promise<{ success: boolean; status: string }> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/process`, {
      method: 'POST',
      headers: createAuthHeaders(token),
    });
    return handleResponse(res);
  },

  /**
   * Fetches job result and URLs.
   */
  async getJobResult(jobId: string, token: string): Promise<JobResultResponse> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/result`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    });
    return handleResponse<JobResultResponse>(res);
  },

  /**
   * Securely downloads processed video blob using Authorization header (no token exposed in URL).
   */
  async downloadVideoBlob(jobId: string, token: string): Promise<Blob> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/download`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    });
    if (!res.ok) {
      let errorMsg = `Download failed (HTTP ${res.status})`;
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch {
        // Body not JSON
      }
      throw new ApiError(errorMsg, res.status);
    }
    return res.blob();
  },

  /**
   * Securely fetches media preview blob (frame or video) using Authorization header.
   */
  async fetchMediaBlob(
    jobId: string,
    token: string,
    type: 'frame' | 'processed' | 'original'
  ): Promise<Blob> {
    const res = await fetch(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/preview?type=${encodeURIComponent(type)}`,
      {
        method: 'GET',
        headers: createAuthHeaders(token),
      }
    );
    if (!res.ok) {
      let errorMsg = `Preview fetch failed (HTTP ${res.status})`;
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch {
        // Body not JSON
      }
      throw new ApiError(errorMsg, res.status);
    }
    return res.blob();
  },

  /**
   * Cancels active job and purges ephemeral files.
   */
  async cancelJob(jobId: string, token: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: createAuthHeaders(token),
    });
    return handleResponse(res);
  },
};
