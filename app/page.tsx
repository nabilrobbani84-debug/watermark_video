'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ComparisonPlayer } from '@/components/ComparisonPlayer';
import { DownloadPanel } from '@/components/DownloadPanel';
import { FaqSection } from '@/components/FaqSection';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { Navbar } from '@/components/Navbar';
import { PrivacyCard } from '@/components/PrivacyCard';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { QualityReportModal } from '@/components/QualityReportModal';
import { RegionSelector } from '@/components/RegionSelector';
import { UploadWorkspace } from '@/components/UploadWorkspace';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  JobStatus,
  ProcessingMethod,
  QualityReport,
  VideoMetadata,
  WatermarkRegion,
} from '@/lib/types';

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('CREATED');
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('Ready for upload');
  const [secondsRemaining, setSecondsRemaining] = useState(900);
  const [metadata, setMetadata] = useState<VideoMetadata | undefined>();
  const [detectedRegion, setDetectedRegion] = useState<WatermarkRegion | undefined>();
  const [qualityReport, setQualityReport] = useState<QualityReport | undefined>();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSessionInvalid, setIsSessionInvalid] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Poll status when in processing, queued, or verifying states
  useEffect(() => {
    if (!jobId || !token) return;
    const isWorking =
      jobStatus === 'PROCESSING' ||
      jobStatus === 'QUEUED' ||
      jobStatus === 'VERIFYING';

    if (!isWorking) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const data = await apiClient.getJobStatus(jobId, token);
        if (!isMounted) return;

        setProgress(data.progress ?? 0);
        setStageMessage(data.stageMessage || 'Processing video frames...');
        setSecondsRemaining(data.secondsRemaining ?? 0);

        if (data.status === 'READY') {
          setJobStatus('READY');
          if (data.qualityReport) {
            setQualityReport(data.qualityReport);
          }
          clearInterval(interval);
        } else if (data.status === 'FAILED') {
          setJobStatus('FAILED');
          setError(data.error || 'Reconstruction engine failed');
          clearInterval(interval);
        } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
          setJobStatus(data.status);
          if (data.status === 'EXPIRED') {
            setIsSessionInvalid(true);
          }
          clearInterval(interval);
        } else {
          setJobStatus(data.status);
        }
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          if (err.isExpired || err.isNotFound) {
            setJobStatus('EXPIRED');
            setStageMessage('Session expired. Ephemeral data purged.');
            setIsSessionInvalid(true);
            clearInterval(interval);
          } else if (err.isAuthError) {
            setJobStatus('FAILED');
            setError('Session unauthorized or invalid. Please start a new session.');
            setIsSessionInvalid(true);
            clearInterval(interval);
          }
        }
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jobId, token, jobStatus]);

  // Execute processing for a confirmed region
  const startProcessing = useCallback(
    async (
      activeJobId: string,
      activeToken: string,
      region: WatermarkRegion,
      method: ProcessingMethod,
    ) => {
      setError(undefined);
      try {
        // 1. Confirm coordinates
        await apiClient.confirmRegion(activeJobId, activeToken, region, method);

        setJobStatus('PROCESSING');
        setProgress(45);
        setStageMessage('Starting video frame reconstruction engine...');

        // 2. Trigger asynchronous background processing
        await apiClient.startProcessing(activeJobId, activeToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Processing error';
        if (err instanceof ApiError && (err.isAuthError || err.isExpired)) {
          setIsSessionInvalid(true);
        }
        setError(msg);
        setJobStatus('FAILED');
      }
    },
    [],
  );

  // Reset workspace: clears all stale job-specific state
  const resetWorkspace = () => {
    setJobId(null);
    setToken(null);
    setJobStatus('CREATED');
    setProgress(0);
    setStageMessage('Ready for upload');
    setMetadata(undefined);
    setDetectedRegion(undefined);
    setQualityReport(undefined);
    setError(undefined);
    setIsLoading(false);
    setLoadingStage('');
    setIsSessionInvalid(false);
  };

  // Handle user uploaded file
  const handleFileSelect = async (file: File) => {
    // Clear stale state before creating a fresh job session
    resetWorkspace();
    setIsLoading(true);
    setLoadingStage('Initializing secure job session...');
    setError(undefined);

    try {
      const session = await apiClient.createJobSession();
      setJobId(session.jobId);
      setToken(session.token);

      setLoadingStage('Uploading media and probing stream headers with FFmpeg...');
      const data = await apiClient.uploadVideo(session.jobId, session.token, file);

      setMetadata(data.metadata);
      setDetectedRegion(data.detectedRegion);

      // Automatic processing flow when detection confidence is reliable
      if (data.canAutoProcess && data.detectedRegion) {
        setStageMessage('Watermark candidate identified. Initiating automatic reconstruction...');
        await startProcessing(
          session.jobId,
          session.token,
          data.detectedRegion,
          'delogo-interpolated',
        );
      } else {
        setJobStatus('AWAITING_CONFIRMATION');
        setProgress(35);
        setStageMessage('Candidate region identified. Please confirm or adjust coordinates.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      if (err instanceof ApiError && (err.isAuthError || err.isExpired)) {
        setIsSessionInvalid(true);
      }
      setError(msg);
      setJobStatus('FAILED');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Handle instant sample video generation
  const handleUseSampleVideo = async () => {
    // Clear stale state before creating a fresh job session
    resetWorkspace();
    setIsLoading(true);
    setLoadingStage('Generating sample test video with moving patterns...');
    setError(undefined);

    try {
      const session = await apiClient.createJobSession();
      setJobId(session.jobId);
      setToken(session.token);

      const data = await apiClient.createSampleVideo(session.jobId, session.token);
      setMetadata(data.metadata);
      setDetectedRegion(data.detectedRegion);

      // Auto process sample if detection is confident
      if (data.canAutoProcess && data.detectedRegion) {
        setStageMessage('Sample watermark identified. Initiating frame reconstruction...');
        await startProcessing(
          session.jobId,
          session.token,
          data.detectedRegion,
          'delogo-interpolated',
        );
      } else {
        setJobStatus('AWAITING_CONFIRMATION');
        setProgress(40);
        setStageMessage('Candidate region detected on sample test video.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sample generation failed';
      if (err instanceof ApiError && (err.isAuthError || err.isExpired)) {
        setIsSessionInvalid(true);
      }
      setError(msg);
      setJobStatus('FAILED');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Confirm region manually
  const handleConfirmRegion = async (region: WatermarkRegion, method: ProcessingMethod) => {
    if (!jobId || !token) return;
    await startProcessing(jobId, token, region, method);
  };

  // Cancel active job
  const handleCancelJob = async () => {
    if (jobId && token) {
      try {
        await apiClient.cancelJob(jobId, token);
      } catch {
        // ignore
      }
    }
    resetWorkspace();
  };

  // Retry processing with current region, avoiding silent reuse of invalid sessions
  const handleRetry = async () => {
    if (isSessionInvalid || !jobId || !token || !detectedRegion) {
      // If session was invalidated or expired, do not silently retry the invalid session
      resetWorkspace();
      return;
    }

    setJobStatus('PROCESSING');
    setError(undefined);
    await startProcessing(jobId, token, detectedRegion, 'delogo-interpolated');
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#080A12] text-slate-100">
      <Navbar onCleanVideoClick={scrollToWorkspace} />

      <Hero onUploadClick={scrollToWorkspace} />

      {/* Main Workspace Section */}
      <section id="workspace" ref={workspaceRef} className="py-12 sm:py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Interactive Video Workspace
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
              Automated temporal frame analysis with boundary interpolation and lossless audio
              preservation.
            </p>
          </div>

          {/* Workflow Stage Container */}
          <div className="space-y-8">
            {/* Step 1: Upload or Sample Selection */}
            {(!jobId || jobStatus === 'CREATED' || jobStatus === 'UPLOADING') && (
              <UploadWorkspace
                onFileSelect={handleFileSelect}
                onUseSampleVideo={handleUseSampleVideo}
                isLoading={isLoading}
                loadingStage={loadingStage}
                metadata={metadata}
                error={error}
              />
            )}

            {/* Step 2: Watermark Region Confirmation (when manual review is required) */}
            {jobId && token && jobStatus === 'AWAITING_CONFIRMATION' && metadata && detectedRegion && (
              <RegionSelector
                jobId={jobId}
                token={token}
                metadata={metadata}
                initialRegion={detectedRegion}
                onConfirm={handleConfirmRegion}
                onCancel={handleCancelJob}
                isProcessing={isLoading}
              />
            )}

            {/* Step 3: Active Processing Monitor */}
            {jobId &&
              (jobStatus === 'PROCESSING' ||
                jobStatus === 'QUEUED' ||
                jobStatus === 'VERIFYING') && (
                <ProcessingMonitor
                  status={jobStatus}
                  progress={progress}
                  stageMessage={stageMessage}
                  onCancel={handleCancelJob}
                />
              )}

            {/* Step 4: Ready State -> Comparison Player & Download Panel */}
            {jobId && jobStatus === 'READY' && token && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <ComparisonPlayer
                  jobId={jobId}
                  token={token}
                  originalLabel="Original Video (With Overlay)"
                  processedLabel="Restored Video (Clean Frame)"
                />

                <DownloadPanel
                  jobId={jobId}
                  token={token}
                  metadata={metadata}
                  qualityReport={qualityReport}
                  initialSecondsRemaining={secondsRemaining}
                  onViewReport={() => setIsReportOpen(true)}
                  onReset={resetWorkspace}
                />
              </div>
            )}

            {/* Failed or Cancelled State */}
            {jobId &&
              (jobStatus === 'FAILED' ||
                jobStatus === 'CANCELLED' ||
                jobStatus === 'EXPIRED') && (
                <div className="p-8 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-4">
                  <h3 className="text-lg font-bold text-white">
                    {jobStatus === 'EXPIRED'
                      ? 'Session Expired'
                      : jobStatus === 'CANCELLED'
                        ? 'Job Cancelled'
                        : 'Processing Error'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {error || stageMessage || 'Temporary files have been securely removed.'}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {jobStatus === 'FAILED' && !isSessionInvalid && (
                      <button
                        onClick={handleRetry}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow transition-colors cursor-pointer"
                      >
                        Retry Processing
                      </button>
                    )}
                    <button
                      onClick={resetWorkspace}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-300 bg-white/10 hover:bg-white/15 rounded-lg shadow transition-colors cursor-pointer"
                    >
                      Start New Session
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Quality Policy Matrix Strip */}
      <section id="quality" className="py-16 bg-[#0a0d1a] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-[#101322] border border-white/10">
              <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">
                STANDARD 01
              </span>
              <h3 className="text-base font-semibold text-white mb-2">
                Native Resolution Preservation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We never downscale your frames or crop the canvas. A 1080p upload produces an exact
                1080p output, and a 4K file maintains every vertical line.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#101322] border border-white/10">
              <span className="text-xs font-mono text-purple-400 font-bold block mb-1">
                STANDARD 02
              </span>
              <h3 className="text-base font-semibold text-white mb-2">
                Frame-Accurate Synchronization
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Frame rate timestamps and audio presentation clocks are strictly aligned. No audio
                pitch shift, no dropped frames, and no sync drift.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#101322] border border-white/10">
              <span className="text-xs font-mono text-emerald-400 font-bold block mb-1">
                STANDARD 03
              </span>
              <h3 className="text-base font-semibold text-white mb-2">
                Boundary Pixel Interpolation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rather than blurring the entire video, our reconstruction engine mathematically
                interpolates only the target bounding box perimeter.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PrivacyCard />

      <FaqSection />

      <Footer />

      {/* Quality Report Modal */}
      {qualityReport && (
        <QualityReportModal
          report={qualityReport}
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
        />
      )}
    </main>
  );
}
