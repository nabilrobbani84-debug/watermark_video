'use client';
/* eslint-disable @next/next/no-img-element */

import {
  Check,
  Crosshair,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ProcessingMethod, VideoMetadata, WatermarkRegion } from '@/lib/types';

interface RegionSelectorProps {
  jobId: string;
  token: string;
  metadata: VideoMetadata;
  initialRegion: WatermarkRegion;
  onConfirm: (region: WatermarkRegion, method: ProcessingMethod) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export function RegionSelector({
  jobId,
  token,
  metadata,
  initialRegion,
  onConfirm,
  onCancel,
  isProcessing,
}: RegionSelectorProps) {
  const [region, setRegion] = useState<WatermarkRegion>(initialRegion);
  const [method, setMethod] = useState<ProcessingMethod>('delogo-interpolated');
  const [frameBlobUrl, setFrameBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    apiClient
      .fetchMediaBlob(jobId, token, 'frame')
      .then((blob) => {
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setFrameBlobUrl(createdUrl);
        }
      })
      .catch(() => {
        // Fallback: If blob fetch fails, keep placeholder
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [jobId, token]);

  const { width: vidW, height: vidH } = metadata;

  // Preset corner helper
  const applyPreset = (corner: 'br' | 'tr' | 'bl' | 'tl' | 'center') => {
    const w = Math.round(vidW * 0.22);
    const h = Math.round(vidH * 0.08);
    const padX = Math.round(vidW * 0.03);
    const padY = Math.round(vidH * 0.04);

    let x = vidW - w - padX;
    let y = vidH - h - padY;
    let label = 'Bottom-Right Corner';

    if (corner === 'tr') {
      x = vidW - w - padX;
      y = padY;
      label = 'Top-Right Corner';
    } else if (corner === 'bl') {
      x = padX;
      y = vidH - h - padY;
      label = 'Bottom-Left Corner';
    } else if (corner === 'tl') {
      x = padX;
      y = padY;
      label = 'Top-Left Corner';
    } else if (corner === 'center') {
      x = Math.round((vidW - w) / 2);
      y = Math.round((vidH - h) / 2);
      label = 'Center Overlay';
    }

    setRegion({
      x,
      y,
      width: w,
      height: h,
      confidence: 0.95,
      label,
    });
  };

  // Calculate percentage positions for visual box inside preview container
  const boxLeftPct = (region.x / vidW) * 100;
  const boxTopPct = (region.y / vidH) * 100;
  const boxWidthPct = (region.width / vidW) * 100;
  const boxHeightPct = (region.height / vidH) * 100;

  return (
    <div className="w-full rounded-2xl bg-[#101322] border border-white/10 p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-purple-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Candidate Region Identified</span>
          </div>
          <h3 className="text-xl font-bold text-white">Watermark Overlay Alignment</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Confirm the detected boundary box or adjust the coordinates manually to match your overlay.
          </p>
          {region.analysisExplanation && (
            <p className="text-[11px] text-cyan-300/90 font-mono mt-1">
              {region.analysisExplanation}
            </p>
          )}
        </div>

        {/* Confidence rating indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono">
          <span>Detection Confidence:</span>
          <span className="font-bold">{Math.round(region.confidence * 100)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6">
        {/* Visual Frame Canvas Preview */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-xl bg-black border border-white/15 overflow-hidden flex items-center justify-center shadow-inner">
            {/* Real extracted frame image */}
            {frameBlobUrl ? (
              <img
                src={frameBlobUrl}
                alt="Video candidate frame"
                className="w-full h-full object-contain"
              />
            ) : null}

            {/* Simulated frame grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Bounding Box Indicator */}
            <div
              style={{
                left: `${boxLeftPct}%`,
                top: `${boxTopPct}%`,
                width: `${boxWidthPct}%`,
                height: `${boxHeightPct}%`,
              }}
              className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/25 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-150 flex items-center justify-center pointer-events-none"
            >
              <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px] whitespace-nowrap border border-cyan-800">
                Overlay [{region.width}×{region.height}]
              </div>
              <Crosshair className="w-4 h-4 text-cyan-200" />
            </div>

            {/* Dimension tag */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-slate-300 text-[10px] font-mono border border-white/10">
              Native: {vidW} × {vidH}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 w-full">
            <span className="text-xs text-slate-400 mr-2">Quick Presets:</span>
            <button
              onClick={() => applyPreset('br')}
              className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            >
              Bottom-Right
            </button>
            <button
              onClick={() => applyPreset('tr')}
              className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            >
              Top-Right
            </button>
            <button
              onClick={() => applyPreset('bl')}
              className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            >
              Bottom-Left
            </button>
            <button
              onClick={() => applyPreset('tl')}
              className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            >
              Top-Left
            </button>
            <button
              onClick={() => applyPreset('center')}
              className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
            >
              Center
            </button>
          </div>
        </div>

        {/* Controls Column */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          {/* Coordinates adjustment sliders */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 pb-2 border-b border-white/10">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Boundary Box Coordinates (Pixels)</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>X Position</span>
                  <span className="font-mono text-cyan-300">{region.x}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, vidW - region.width)}
                  value={region.x}
                  onChange={(e) => setRegion({ ...region, x: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Y Position</span>
                  <span className="font-mono text-cyan-300">{region.y}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, vidH - region.height)}
                  value={region.y}
                  onChange={(e) => setRegion({ ...region, y: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Width</span>
                  <span className="font-mono text-cyan-300">{region.width}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max={Math.min(vidW, 600)}
                  value={region.width}
                  onChange={(e) => setRegion({ ...region, width: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Height</span>
                  <span className="font-mono text-cyan-300">{region.height}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max={Math.min(vidH, 300)}
                  value={region.height}
                  onChange={(e) => setRegion({ ...region, height: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Reconstruction Method Selector */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Restoration Technique
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setMethod('delogo-interpolated')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  method === 'delogo-interpolated'
                    ? 'border-purple-500 bg-purple-950/30 text-white'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Delogo Boundary Interpolation (Recommended)
                  </span>
                  {method === 'delogo-interpolated' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Smoothly interpolates boundary pixels around the watermark without altering resolution.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMethod('boxblur-blend')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  method === 'boxblur-blend'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Blended Boundary Blur
                  </span>
                  {method === 'boxblur-blend' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Softens high-contrast text edges using weighted boundary blur.
                </p>
              </button>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onConfirm(region, method)}
              disabled={isProcessing}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 rounded-lg shadow-lg shadow-purple-900/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>Confirm & Restore Video</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
