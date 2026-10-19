'use client';

import { ArrowRight, CheckCircle2, Cpu, FileCheck2, Lock, Sparkles } from 'lucide-react';
import React from 'react';
import { Hero3DScene } from './Hero3DScene';

interface HeroProps {
  onUploadClick: () => void;
}

export function Hero({ onUploadClick }: HeroProps) {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-violet-600/15 via-purple-600/10 to-cyan-500/10 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headlines, copy, trust indicators, CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 mb-6 backdrop-blur-sm">
              <span className="text-purple-400 font-semibold">VanishFrame</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span>Next-Gen Video Restoration</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] text-balance">
              Every Frame, <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
                Beautifully Refined.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 mb-8 max-w-xl leading-relaxed">
              Process your videos with intelligent region detection and restoration.
              Preserve your original resolution, keep your files private with ephemeral storage,
              and download your result when it&apos;s ready.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 mb-10 w-full sm:w-auto">
              <button
                onClick={onUploadClick}
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 rounded-xl hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-purple-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Upload Your Video</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <a
                href="#workflow"
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-colors flex items-center justify-center gap-2 text-center"
              >
                See How It Works
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/10 w-full">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Zero Permanent Storage</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Resolution Preserved</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                <span>FFmpeg Frame Engine</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileCheck2 className="w-4 h-4 text-violet-400 shrink-0" />
                <span>Transparent Quality Log</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Holographic Scene */}
          <div className="lg:col-span-5 relative w-full flex items-center justify-center">
            <Hero3DScene />
          </div>
        </div>

        {/* Visual Workflow Steps Strip */}
        <div id="workflow" className="mt-16 pt-8 border-t border-white/10">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-4 text-center sm:text-left">
            Production Video Pipeline
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#101322] border border-white/10 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center shrink-0">
                01
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Upload</h4>
                <p className="text-xs text-slate-400 mt-0.5">Drag & drop MP4, MOV, or WebM media.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#101322] border border-white/10 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0">
                02
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Analyze</h4>
                <p className="text-xs text-slate-400 mt-0.5">Automated candidate watermark detection.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#101322] border border-white/10 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 font-bold text-xs flex items-center justify-center shrink-0">
                03
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Process</h4>
                <p className="text-xs text-slate-400 mt-0.5">Delogo pixel boundary reconstruction.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#101322] border border-white/10 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                04
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Download</h4>
                <p className="text-xs text-slate-400 mt-0.5">Preview result and download before expiry.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
