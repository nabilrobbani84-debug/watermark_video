'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  const workspaceRef = useRef<HTMLDivElement>(null);

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Poll status when in processing or verifying states
  useEffect(() => {
    if (!jobId || (jobStatus !== 'PROCESSING' && jobStatus !== 'VERIFYING')) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();

        setProgress(data.progress);
        setStageMessage(data.stageMessage);
        setJobStatus(data.status);
        setSecondsRemaining(data.secondsRemaining);

        if (data.qualityReport) {
          setQualityReport(data.qualityReport);
        }

        if (data.status === 'READY' || data.status === 'FAILED') {
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  // Create session helper
  const createSession = async () => {
    const res = await fetch('/api/v1/jobs', { method: 'POST' });
    if (!res.ok) throw new Error('Could not initialize video processing session');
    return (await res.json()) as { jobId: string; token: string; expiresAt: number };
  };

  // Handle user uploaded file
  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setLoadingStage('Initializing secure job session...');
    setError(undefined);

    try {
      const session = await createSession();
      setJobId(session.jobId);
      setToken(session.token);

      setLoadingStage('Uploading media and probing stream headers...');
      const formData = new FormData();
      formData.append('video', file);

      const uploadRes = await fetch(`/api/v1/jobs/${session.jobId}/upload`, {
        method: 'POST',
        headers: {
          'x-job-token': session.token,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await uploadRes.json();
      setMetadata(data.metadata);
      setDetectedRegion(data.detectedRegion);
      setJobStatus('AWAITING_CONFIRMATION');
      setProgress(40);
      setStageMessage('Watermark candidate identified. Awaiting alignment confirmation.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      setJobStatus('FAILED');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Handle instant sample video generation
  const handleUseSampleVideo = async () => {
    setIsLoading(true);
    setLoadingStage('Generating sample video with overlay...');
    setError(undefined);

    try {
      const session = await createSession();
      setJobId(session.jobId);
      setToken(session.token);

      const res = await fetch(`/api/v1/jobs/${session.jobId}/sample`, {
        method: 'POST',
        headers: {
          'x-job-token': session.token,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Sample video generation failed');
      }

      const data = await res.json();
      setMetadata(data.metadata);
      setDetectedRegion(data.detectedRegion);
      setJobStatus('AWAITING_CONFIRMATION');
      setProgress(40);
      setStageMessage('Watermark candidate identified on sample test video.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sample generation failed';
      setError(msg);
      setJobStatus('FAILED');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Confirm region and start processing
  const handleConfirmRegion = async (region: WatermarkRegion, method: ProcessingMethod) => {
    if (!jobId || !token) return;

    setError(undefined);
    try {
      // 1. Confirm coordinates
      const confRes = await fetch(`/api/v1/jobs/${jobId}/confirm-region`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-job-token': token,
        },
        body: JSON.stringify({ region, method }),
      });

      if (!confRes.ok) {
        const errData = await confRes.json();
        throw new Error(errData.error || 'Failed to confirm region');
      }

      setJobStatus('PROCESSING');
      setProgress(50);
      setStageMessage('Reconstructing video frames with delogo engine...');

      // 2. Trigger processing
      const procRes = await fetch(`/api/v1/jobs/${jobId}/process`, {
        method: 'POST',
        headers: {
          'x-job-token': token,
        },
      });

      if (!procRes.ok) {
        const errData = await procRes.json();
        throw new Error(errData.error || 'Reconstruction engine failed');
      }

      const data = await procRes.json();
      if (data.qualityReport) {
        setQualityReport(data.qualityReport);
      }
      setJobStatus('READY');
      setProgress(100);
      setStageMessage('Reconstruction complete and verified.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing error';
      setError(msg);
      setJobStatus('FAILED');
    }
  };

  // Cancel active job
  const handleCancelJob = async () => {
    if (jobId && token) {
      try {
        await fetch(`/api/v1/jobs/${jobId}`, {
          method: 'DELETE',
          headers: { 'x-job-token': token },
        });
      } catch {
        // ignore
      }
    }
    resetWorkspace();
  };

  // Reset workspace
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
              Inspect candidate regions, customize boundary coordinates, and execute genuine
              video frame reconstruction.
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

            {/* Step 2: Watermark Region Confirmation */}
            {jobId && jobStatus === 'AWAITING_CONFIRMATION' && metadata && detectedRegion && (
              <RegionSelector
                jobId={jobId}
                metadata={metadata}
                initialRegion={detectedRegion}
                onConfirm={handleConfirmRegion}
                onCancel={handleCancelJob}
                isProcessing={isLoading}
              />
            )}

            {/* Step 3: Active Processing Monitor */}
            {jobId && (jobStatus === 'PROCESSING' || jobStatus === 'QUEUED' || jobStatus === 'VERIFYING') && (
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
            {jobId && (jobStatus === 'FAILED' || jobStatus === 'CANCELLED' || jobStatus === 'EXPIRED') && (
              <div className="p-8 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {jobStatus === 'EXPIRED' ? 'Session Expired' : 'Processing Failed or Cancelled'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {error || stageMessage || 'Temporary files have been securely removed.'}
                </p>
                <button
                  onClick={resetWorkspace}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow transition-colors cursor-pointer"
                >
                  Start New Session
                </button>
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
              <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">STANDARD 01</span>
              <h3 className="text-base font-semibold text-white mb-2">Native Resolution Preservation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We never downscale your frames or crop the canvas. A 1080p upload produces an exact 1080p output,
                and a 4K file maintains every vertical line.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#101322] border border-white/10">
              <span className="text-xs font-mono text-purple-400 font-bold block mb-1">STANDARD 02</span>
              <h3 className="text-base font-semibold text-white mb-2">Frame-Accurate Synchronization</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Frame rate timestamps and audio presentation clocks are strictly aligned. No audio pitch shift,
                no dropped frames, and no sync drift.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#101322] border border-white/10">
              <span className="text-xs font-mono text-emerald-400 font-bold block mb-1">STANDARD 03</span>
              <h3 className="text-base font-semibold text-white mb-2">Boundary Pixel Interpolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rather than blurring the entire video, our reconstruction engine mathematically interpolates
                only the target bounding box perimeter.
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
