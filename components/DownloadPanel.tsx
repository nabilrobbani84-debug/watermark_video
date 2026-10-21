'use client';

import {
  Clock,
  Download,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { QualityReport, VideoMetadata } from '@/lib/types';

interface DownloadPanelProps {
  jobId: string;
  token: string;
  metadata?: VideoMetadata;
  qualityReport?: QualityReport;
  initialSecondsRemaining: number;
  onViewReport: () => void;
  onReset: () => void;
}

export function DownloadPanel({
  jobId,
  token,
  metadata,
  qualityReport,
  initialSecondsRemaining,
  onViewReport,
  onReset,
}: DownloadPanelProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSecondsRemaining);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const blob = await apiClient.downloadVideoBlob(jobId, token);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `vanishframe_cleaned_${jobId.slice(0, 8)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const isExpired = secondsRemaining <= 0;

  return (
    <div className="w-full rounded-2xl bg-gradient-to-b from-[#14182c] to-[#0c0f1c] border border-white/15 p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reconstruction Ready & Verified</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">Your Video Is Cleaned</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Original resolution and audio preserved. Download now before the ephemeral session expires.
          </p>
        </div>

        {/* Expiration Countdown Pill */}
        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border ${
            isExpired
              ? 'bg-red-950/40 border-red-800/50 text-red-400'
              : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {isExpired ? 'Session Expired' : `Auto-Purge in: ${formatCountdown(secondsRemaining)}`}
          </span>
        </div>
      </div>

      {/* Main Download Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-6 p-4 rounded-xl bg-black/40 border border-white/10">
        <div className="flex items-center gap-4 text-left w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-[1.5px] shrink-0">
            <div className="w-full h-full bg-[#101322] rounded-[10.5px] flex items-center justify-center">
              <Download className="w-6 h-6 text-cyan-300" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              vanishframe_cleaned_{jobId.slice(0, 8)}.mp4
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <span>{qualityReport?.outputResolution || `${metadata?.width}x${metadata?.height}`}</span>
              <span aria-hidden="true">·</span>
              <span>H.264 High</span>
              <span aria-hidden="true">·</span>
              <span>FastStart Web-Optimized</span>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isExpired || isDownloading}
          className={`w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
            isExpired
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 shadow-purple-900/40'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Serving Download...' : 'Download Processed Video'}</span>
        </button>
      </div>

      {downloadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs text-center font-medium animate-in fade-in">
          {downloadError}
        </div>
      )}

      {/* Secondary Actions & Privacy Assurance */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Privacy Guarantee: Files are completely purged from disk when the timer reaches zero.</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onViewReport}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-violet-400" />
            <span>Quality Report</span>
          </button>

          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Process Another Video</span>
          </button>
        </div>
      </div>
    </div>
  );
}
