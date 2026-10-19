import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VanishFrame — Video Watermark Cleaner & Frame Restoration',
  description: 'Browser-based video watermark and overlay cleaner with intelligent region detection, genuine frame reconstruction, and privacy-first ephemeral storage.',
  openGraph: {
    title: 'VanishFrame — Video Watermark Cleaner & Frame Restoration',
    description: 'Process and reconstruct video frames with intelligent region detection while preserving original resolution and audio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VanishFrame — Video Watermark Cleaner',
    description: 'Intelligent video watermark detection and reconstruction with privacy-first ephemeral processing.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#080A12] text-slate-100 antialiased selection:bg-purple-600/30 selection:text-purple-200">
        {children}
      </body>
    </html>
  );
}
