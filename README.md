# VanishFrame — Video Watermark & Overlay Cleaner

A modern, privacy-first web application for detecting and removing watermarks, logos, and overlays from videos directly in the browser using FFmpeg Delogo interpolation and Next.js.

## ✨ Features

- **Interactive Region Selector**: Drag, resize, and fine-tune watermark bounding boxes directly over video frames.
- **Side-by-Side Comparison**: Split-view player to inspect original vs processed output frame-by-frame.
- **Lossless Audio & Resolution Preservation**: Retains source dimensions, frame rates, and synced audio tracks without downscaling.
- **Privacy-First Ephemeral Storage**: Uploads and processed outputs are stored temporarily and automatically purged after 15 minutes.
- **Transparent Quality Reports**: Real-time logging of encoding bitrate, delta artifacts, and processing duration.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Visuals & Animations**: [Motion](https://motion.dev/), [Three.js](https://threejs.org/), [Lucide React](https://lucide.dev/)
- **Video Engine**: FFmpeg with Delogo filter pipeline

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.18 or later recommended)
- [FFmpeg](https://ffmpeg.org/) installed and available in system PATH

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nabilrobbani84-debug/watermark_video.git
   cd watermark_video
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to use the app.

## 📁 Project Structure

```
├── app/
│   ├── api/v1/jobs/     # API routes for upload, processing, preview, and download
│   ├── globals.css      # Global styling & Tailwind directives
│   ├── layout.tsx       # Root layout & SEO metadata
│   └── page.tsx         # Main interactive landing page & workspace
├── components/          # Reusable UI components & video players
├── hooks/               # Custom React hooks
├── lib/                 # FFmpeg runner, job store, and utility functions
└── public/              # Static assets
```

## 🔒 Privacy & Data Retention

Files processed through VanishFrame are held strictly in ephemeral local storage during your active session. Files are permanently deleted when:
- The 15-minute countdown timer expires.
- The user cancels the job.
- The user cleans the workspace.

## 📄 License

MIT License.
