export type JobStatus =
  | 'CREATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'ANALYZING'
  | 'AWAITING_CONFIRMATION'
  | 'QUEUED'
  | 'PROCESSING'
  | 'VERIFYING'
  | 'READY'
  | 'DOWNLOADING'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED';

export type ProcessingMethod =
  | 'delogo-interpolated'
  | 'boxblur-blend'
  | 'inpaint-temporal';

export interface WatermarkRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

export interface VideoMetadata {
  filename: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec?: string;
  size: number;
  bitRate?: number;
  hasAudio: boolean;
}

export interface QualityReport {
  resolutionPreserved: boolean;
  fpsPreserved: boolean;
  audioPreserved: boolean;
  videoReencoded: boolean;
  inputCodec: string;
  outputCodec: string;
  inputSize: number;
  outputSize: number;
  inputResolution: string;
  outputResolution: string;
  inputDuration: number;
  outputDuration: number;
  notes: string[];
}

export interface Job {
  id: string;
  token: string;
  status: JobStatus;
  progress: number;
  stageMessage: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  originalFileName?: string;
  originalFilePath?: string;
  processedFilePath?: string;
  previewThumbnailPath?: string;
  metadata?: VideoMetadata;
  detectedRegion?: WatermarkRegion;
  confirmedRegion?: WatermarkRegion;
  processingMethod: ProcessingMethod;
  qualityReport?: QualityReport;
  error?: string;
}

export interface CreateJobResponse {
  jobId: string;
  token: string;
  expiresAt: number;
}

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  stageMessage: string;
  expiresAt: number;
  secondsRemaining: number;
  metadata?: VideoMetadata;
  detectedRegion?: WatermarkRegion;
  confirmedRegion?: WatermarkRegion;
  qualityReport?: QualityReport;
  hasProcessedVideo: boolean;
  error?: string;
}
