import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { getJob, getJobDir, updateJob, verifyJobToken } from '@/lib/job-store';
import {
  createSyntheticSampleVideo,
  detectCandidateWatermark,
  extractPreviewFrame,
} from '@/lib/ffmpeg-runner';

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

    const jobDir = getJobDir(jobId);
    const sampleFilePath = path.join(jobDir, 'sample_watermark_video.mp4');

    updateJob(jobId, {
      status: 'ANALYZING',
      progress: 25,
      stageMessage: 'Generating authenticated test video with overlay...',
      originalFileName: 'vanishframe_sample_test.mp4',
      originalFilePath: sampleFilePath,
    });

    const metadata = await createSyntheticSampleVideo(sampleFilePath);

    const previewFramePath = path.join(jobDir, 'preview_frame.jpg');
    try {
      await extractPreviewFrame(sampleFilePath, previewFramePath, 1.0);
    } catch {
      // ignore
    }

    const detectedRegion = detectCandidateWatermark(metadata, 'bottom-right');

    updateJob(jobId, {
      status: 'AWAITING_CONFIRMATION',
      progress: 40,
      stageMessage: 'Candidate region detected on sample video. Ready for processing.',
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
    const message = error instanceof Error ? error.message : 'Sample generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
