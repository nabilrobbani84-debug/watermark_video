'use client';

import {
  AlertCircle,
  Clock,
  Film,
  HardDrive,
  Layers,
  Sparkles,
  UploadCloud,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { VideoMetadata } from '@/lib/types';

interface UploadWorkspaceProps {
  onFileSelect: (file: File) => void;
  onUseSampleVideo: () => void;
  isLoading: boolean;
  loadingStage?: string;
  metadata?: VideoMetadata;
  error?: string;
}

export function UploadWorkspace({
  onFileSelect,
  onUseSampleVideo,
  isLoading,
  loadingStage,
  metadata,
  error,
}: UploadWorkspaceProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndPass(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndPass(file);
    }
  };

  const validateAndPass = (file: File) => {
    const validExtensions = ['mp4', 'mov', 'webm', 'mkv', 'avi'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      alert('Please upload a supported video format (.mp4, .mov, .webm, .mkv).');
      return;
    }
    onFileSelect(file);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="w-full">
      {/* Upload Drop Zone Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative w-full rounded-2xl p-8 sm:p-12 transition-all cursor-pointer text-center border-2 ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20 shadow-2xl shadow-cyan-950/50 scale-[1.01]'
            : 'border-dashed border-white/15 bg-[#101322]/80 hover:border-violet-500/50 hover:bg-[#14182c]'
        } ${isLoading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          className="hidden"
          onChange={handleInputChange}
          disabled={isLoading}
        />

        {/* Floating Upload Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600/20 via-purple-500/20 to-cyan-400/20 border border-white/15 flex items-center justify-center mb-6 shadow-inner">
          <UploadCloud
            className={`w-10 h-10 transition-transform ${
              isDragging ? 'scale-110 text-cyan-300' : 'text-purple-300 group-hover:scale-105'
            }`}
          />
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Drop your video here
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          Drag and drop your video file or click to browse. Max size 200MB. Supported formats: MP4, MOV, WebM, MKV.
        </p>

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow-md transition-colors"
          >
            Select Video File
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUseSampleVideo();
            }}
            disabled={isLoading}
            className="px-5 py-2.5 text-xs font-semibold text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Try with Sample Video</span>
          </button>
        </div>

        {/* Loading Spinner during analysis */}
        {isLoading && (
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-300">
              {loadingStage || 'Processing video stream...'}
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-center gap-3 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Rights Confirmation Notice */}
      <div className="mt-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-slate-400">
        <span>
          Compliance: Process only videos for which you have authorized editing permissions.
        </span>
        <span className="font-mono text-slate-500 hidden sm:inline">EPHEMERAL_MODE</span>
      </div>

      {/* Video Metadata Panel if available */}
      {metadata && (
        <div className="mt-6 p-6 rounded-2xl bg-[#101322] border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                {metadata.filename}
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
              {metadata.codec.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <span className="text-slate-500 block mb-1">Resolution</span>
              <span className="font-semibold text-slate-200 font-mono">
                {metadata.width} × {metadata.height}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <span className="text-slate-500 block mb-1">Duration & FPS</span>
              <span className="font-semibold text-slate-200 font-mono">
                {metadata.duration}s · {metadata.fps} fps
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <span className="text-slate-500 block mb-1">File Size</span>
              <span className="font-semibold text-slate-200 font-mono">
                {formatBytes(metadata.size)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <span className="text-slate-500 block mb-1">Audio Track</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                {metadata.hasAudio ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{metadata.audioCodec?.toUpperCase() || 'Preserved'}</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    <span>No Audio</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
