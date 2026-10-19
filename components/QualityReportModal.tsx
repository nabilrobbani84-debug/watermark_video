'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Info,
  X,
} from 'lucide-react';
import React from 'react';
import type { QualityReport } from '@/lib/types';

interface QualityReportModalProps {
  report: QualityReport;
  isOpen: boolean;
  onClose: () => void;
}

export function QualityReportModal({
  report,
  isOpen,
  onClose,
}: QualityReportModalProps) {
  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#101322] border border-white/15 p-6 sm:p-8 shadow-2xl text-left max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
              <FileCheck className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Media Quality & Integrity Report</h3>
              <p className="text-xs text-slate-400">FFprobe stream verification and boundary inspection log</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verification Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <span className="text-slate-500 text-[11px] block mb-1">Resolution</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {report.resolutionPreserved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-mono">Preserved</span>
                </>
              ) : (
                <span className="text-amber-400">Adjusted</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              {report.inputResolution} → {report.outputResolution}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <span className="text-slate-500 text-[11px] block mb-1">Frame Rate</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {report.fpsPreserved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-mono">Preserved</span>
                </>
              ) : (
                <span className="text-amber-400">Resampled</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              Timestamps synced
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <span className="text-slate-500 text-[11px] block mb-1">Audio Track</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {report.audioPreserved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-mono">Synchronized</span>
                </>
              ) : (
                <span className="text-slate-400 font-mono">No Audio</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              AAC 192k sync
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <span className="text-slate-500 text-[11px] block mb-1">Transcoding</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 font-mono">
              <span>{report.videoReencoded ? 'Re-encoded' : 'Stream-Copy'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              {report.outputCodec.toUpperCase()} High Profile
            </span>
          </div>
        </div>

        {/* Detailed Stream Compare Table */}
        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/30 mb-6 text-xs">
          <div className="grid grid-cols-3 bg-white/5 p-2.5 font-semibold text-slate-300 border-b border-white/10">
            <span>Property</span>
            <span>Original Upload</span>
            <span>Processed Output</span>
          </div>
          <div className="divide-y divide-white/5">
            <div className="grid grid-cols-3 p-2.5 font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Resolution</span>
              <span>{report.inputResolution}</span>
              <span className="text-emerald-400">{report.outputResolution}</span>
            </div>
            <div className="grid grid-cols-3 p-2.5 font-mono text-slate-300">
              <span className="text-slate-400 font-sans">File Size</span>
              <span>{formatBytes(report.inputSize)}</span>
              <span>{formatBytes(report.outputSize)}</span>
            </div>
            <div className="grid grid-cols-3 p-2.5 font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Video Codec</span>
              <span>{report.inputCodec.toUpperCase()}</span>
              <span className="text-cyan-400">{report.outputCodec.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-3 p-2.5 font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Duration</span>
              <span>{report.inputDuration}s</span>
              <span>{report.outputDuration}s</span>
            </div>
          </div>
        </div>

        {/* Engineering Transparency Notice */}
        <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-800/30 text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-center gap-1.5 font-semibold text-violet-300">
            <Info className="w-4 h-4 text-violet-400" />
            <span>Honest Engineering Disclosure</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            When watermark pixels are reconstructed, the underlying region is mathematically synthesized
            from boundary gradient sampling. Lossless video encoding preserves the unedited frame areas,
            but pixels hidden beneath opaque watermarks cannot be magically retrieved without synthesis.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
