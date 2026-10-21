'use client';

import {
  Columns2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface ComparisonPlayerProps {
  jobId: string;
  token: string;
  originalLabel?: string;
  processedLabel?: string;
}

export function ComparisonPlayer({
  jobId,
  token,
  originalLabel = 'Original Video',
  processedLabel = 'Restored Video',
}: ComparisonPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0-100
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const [procVideoUrl, setProcVideoUrl] = useState<string | null>(null);
  const [origVideoUrl, setOrigVideoUrl] = useState<string | null>(null);

  const origVideoRef = useRef<HTMLVideoElement>(null);
  const procVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let procUrl: string | null = null;
    let origUrl: string | null = null;

    apiClient
      .fetchMediaBlob(jobId, token, 'processed')
      .then((blob) => {
        if (active) {
          procUrl = URL.createObjectURL(blob);
          setProcVideoUrl(procUrl);
        }
      })
      .catch(() => {});

    apiClient
      .fetchMediaBlob(jobId, token, 'original')
      .then((blob) => {
        if (active) {
          origUrl = URL.createObjectURL(blob);
          setOrigVideoUrl(origUrl);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (procUrl) URL.revokeObjectURL(procUrl);
      if (origUrl) URL.revokeObjectURL(origUrl);
    };
  }, [jobId, token]);

  // Sync videos on timeupdate
  const handleTimeUpdate = () => {
    if (procVideoRef.current) {
      setCurrentTime(procVideoRef.current.currentTime);
      if (!duration && procVideoRef.current.duration) {
        setDuration(procVideoRef.current.duration);
      }
    }
  };

  const togglePlay = () => {
    if (!procVideoRef.current || !origVideoRef.current) return;
    if (isPlaying) {
      procVideoRef.current.pause();
      origVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Sync timestamps before playing
      origVideoRef.current.currentTime = procVideoRef.current.currentTime;
      procVideoRef.current.play().catch(() => {});
      origVideoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
    if (procVideoRef.current) procVideoRef.current.currentTime = targetTime;
    if (origVideoRef.current) origVideoRef.current.currentTime = targetTime;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (procVideoRef.current) procVideoRef.current.muted = next;
    if (origVideoRef.current) origVideoRef.current.muted = next;
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (procVideoRef.current) procVideoRef.current.playbackRate = speed;
    if (origVideoRef.current) origVideoRef.current.playbackRate = speed;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl bg-[#0c0f1c] border border-white/10 p-6 shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-white">Reconstruction Preview & Comparison</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Slide horizontally to inspect boundary interpolation against the original frame.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'split'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              <span>Split Slider</span>
            </span>
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Columns2 className="w-3 h-3" />
              <span>Side-by-Side</span>
            </span>
          </button>
        </div>
      </div>

      {/* Video Display Surface */}
      <div className="relative my-4 aspect-video rounded-xl bg-black overflow-hidden border border-white/10 select-none">
        {viewMode === 'split' ? (
          <div className="relative w-full h-full">
            {/* Processed video (background full) */}
            <video
              ref={procVideoRef}
              src={procVideoUrl || ''}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              playsInline
            />

            {/* Original video (clipped with slider position) */}
            <div
              style={{ width: `${sliderPosition}%` }}
              className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] z-10"
            >
              <div className="relative w-full h-full min-w-full">
                <video
                  ref={origVideoRef}
                  src={origVideoUrl || ''}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  playsInline
                />
              </div>

              {/* Watermark before label tag */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-cyan-300 font-mono text-[11px] border border-cyan-800/60 z-20">
                {originalLabel}
              </div>
            </div>

            {/* After watermark label tag */}
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-purple-300 font-mono text-[11px] border border-purple-800/60 z-20">
              {processedLabel}
            </div>

            {/* Invisible Range Slider over entire frame to drag split line */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              aria-label="Comparison split slider"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            />
          </div>
        ) : (
          /* Side by Side Mode */
          <div className="grid grid-cols-2 w-full h-full divide-x divide-white/10">
            <div className="relative h-full">
              <video
                ref={origVideoRef}
                src={origVideoUrl || ''}
                className="w-full h-full object-contain"
                playsInline
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-cyan-300 font-mono text-[11px] border border-cyan-800/60">
                {originalLabel}
              </div>
            </div>

            <div className="relative h-full">
              <video
                ref={procVideoRef}
                src={procVideoUrl || ''}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                playsInline
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-purple-300 font-mono text-[11px] border border-purple-800/60">
                {processedLabel}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Synchronized Playback Controls Bar */}
      <div className="space-y-3 pt-2">
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 10}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            aria-label="Timeline seek scrubber"
            className="w-full accent-violet-500 cursor-pointer h-1.5 rounded-lg bg-white/10"
          />
          <span>{formatTime(duration)}</span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow transition-colors cursor-pointer"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
              <span className="mr-1">Speed:</span>
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    playbackSpeed === s ? 'text-cyan-400 font-bold bg-white/10' : 'hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded hidden sm:inline">
              Synchronized Frame Sync
            </span>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
