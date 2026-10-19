import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getJob, getJobDir, sanitizeFileName, updateJob, verifyJobToken } from '@/lib/job-store';
import {
  detectCandidateWatermark,
  extractPreviewFrame,
  probeVideo,
} from '@/lib/ffmpeg-runner';

// Max file size: 200MB
const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const token = req.headers.get('x-job-token') || req.nextUrl.searchParams.get('token');

    const job = getJob(jobId);
    if (!job || !verifyJobToken(job, token)) {
      return NextResponse.json({ error: 'Unauthorized or invalid job session' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum upload size of 200MB' },
        { status: 413 }
      );
    }

    const jobDir = getJobDir(jobId);
    const safeName = sanitizeFileName(file.name || 'uploaded_video.mp4');
    const targetFilePath = path.join(jobDir, `orig_${safeName}`);

    // Convert file to ArrayBuffer and save to ephemeral disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(targetFilePath, Buffer.from(arrayBuffer));

    updateJob(jobId, {
      status: 'ANALYZING',
      progress: 20,
      stageMessage: 'Analyzing media stream metadata with ffprobe...',
      originalFileName: file.name,
      originalFilePath: targetFilePath,
    });

    // Probe video with ffprobe
    const metadata = await probeVideo(targetFilePath);

    // Extract reference frame for user visualization
    const previewFramePath = path.join(jobDir, 'preview_frame.jpg');
    try {
      await extractPreviewFrame(targetFilePath, previewFramePath, Math.min(1.0, metadata.duration / 2));
    } catch {
      // Ignore preview frame extraction failure if video is very short
    }

    // Automatically detect candidate watermark region
    const detectedRegion = detectCandidateWatermark(metadata, 'bottom-right');

    updateJob(jobId, {
      status: 'AWAITING_CONFIRMATION',
      progress: 35,
      stageMessage: 'Candidate watermark region detected. Awaiting confirmation.',
      metadata,
      detectedRegion,
      confirmedRegion: detectedRegion,
      previewThumbnailPath: previewFramePath,
    });

    return NextResponse.json({
      success: true,
      metadata,
      detectedRegion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
