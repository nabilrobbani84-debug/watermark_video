'use client';

import { ChevronDown, HelpCircle } from 'lucide-react';
import React, { useState } from 'react';

const faqs = [
  {
    question: 'Does the website store my video permanently?',
    answer:
      'No. VanishFrame uses purely ephemeral, temporary storage. We do not maintain any permanent video databases, S3 buckets, or permanent disks. Files exist only in temporary directories for the duration of your session.',
  },
  {
    question: 'How long is the processed video available?',
    answer:
      'Videos remain available for exactly 15 minutes after processing begins. A server-side background cleanup process automatically and permanently removes both the original upload and the processed video file when the countdown expires.',
  },
  {
    question: 'Will the resolution change during processing?',
    answer:
      'No. The FFmpeg reconstruction pipeline strictly preserves the exact horizontal and vertical pixel dimensions (e.g., 1920x1080 or 1280x720) of your source container. No automatic downscaling or cropping occurs.',
  },
  {
    question: 'Is the original audio preserved and synchronized?',
    answer:
      'Yes. Audio tracks are either stream-copied directly or remuxed with high-bitrate AAC synchronization, preserving full fidelity and stereo/surround channels without audio drift.',
  },
  {
    question: 'Why might watermark restoration leave subtle visual artifacts?',
    answer:
      'Because pixels hidden underneath an opaque watermark are absent in the source frame, the restoration engine calculates mathematical gradient interpolation from the outer perimeter of the bounding box. On complex moving backgrounds, minor smoothing or gradient blending may be detectable.',
  },
  {
    question: 'What video formats are supported?',
    answer:
      'We support standard creator formats including MP4 (H.264 / H.265), QuickTime MOV, WebM (VP8 / VP9 / AV1), and MKV containers up to 200MB per file.',
  },
  {
    question: 'Can I process high-resolution 4K or 60 FPS videos?',
    answer:
      'Yes, as long as the file size is within the 200MB limit. 60 FPS frame rates and high bitrates are maintained throughout the reconstruction pipeline.',
  },
  {
    question: 'What happens if processing fails or is cancelled?',
    answer:
      'If processing fails or if you click the Cancel button, the temporary file directory for that job is purged immediately to free disk space and protect your privacy.',
  },
  {
    question: 'Can I use VanishFrame on mobile devices?',
    answer:
      'Yes! The web application is fully responsive. On mobile screens, the upload zone, boundary box fine-tuning, and comparison player adapt seamlessly to touch gestures.',
  },
  {
    question: 'Can I download the result more than once before expiry?',
    answer:
      'Yes. As long as your 15-minute ephemeral session has not expired and you retain your capability token, you can download the verified MP4 file multiple times.',
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 border-t border-white/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs text-purple-400 font-semibold mb-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Transparent Answers.
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Everything you need to know about video processing, quality preservation, and ephemeral privacy.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-xl bg-[#101322] border border-white/10 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02]"
                >
                  <span className="text-sm font-semibold text-slate-200">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-400 leading-relaxed border-t border-white/5 animate-in fade-in duration-150">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
