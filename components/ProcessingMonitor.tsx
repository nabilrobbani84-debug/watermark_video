'use client';

import {
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { JobStatus } from '@/lib/types';

interface ProcessingMonitorProps {
  status: JobStatus;
  progress: number;
  stageMessage: string;
  onCancel: () => void;
}

export function ProcessingMonitor({
  status,
  progress,
  stageMessage,
  onCancel,
}: ProcessingMonitorProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const stages = [
    { title: 'Upload & Inspect', done: progress >= 25, active: progress < 25 },
    { title: 'Region Alignment', done: progress >= 45, active: progress >= 25 && progress < 45 },
    { title: 'Frame Reconstruction', done: progress >= 85, active: progress >= 45 && progress < 85 },
    { title: 'Integrity Verification', done: progress >= 100, active: progress >= 85 && progress < 100 },
  ];

  return (
    <div className="w-full rounded-2xl bg-[#101322] border border-white/10 p-8 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-violet-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Video Reconstruction Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{stageMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Elapsed: {formatElapsed(secondsElapsed)}</span>
          </div>

          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 border border-red-800/40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="my-8">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="font-semibold text-slate-300">Processing Progress</span>
          <span className="font-mono text-cyan-400 font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-black/50 border border-white/10 overflow-hidden p-0.5">
          <div
            style={{ width: `${Math.max(5, progress)}%` }}
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
          />
        </div>
      </div>

      {/* Pipeline Stage Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stages.map((stage, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border text-left transition-colors ${
              stage.done
                ? 'border-emerald-600/40 bg-emerald-950/20 text-emerald-300'
                : stage.active
                ? 'border-violet-500/60 bg-violet-950/30 text-white'
                : 'border-white/5 bg-white/[0.02] text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {stage.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : stage.active ? (
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
              )}
              <span className="text-xs font-semibold truncate">{stage.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
