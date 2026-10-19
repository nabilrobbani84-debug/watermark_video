'use client';

import { Shield, Sparkles } from 'lucide-react';
import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#06080e] py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-white/5">
          {/* Brand & Tagline */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-violet-600 to-cyan-400 p-[1px] flex items-center justify-center">
                <div className="w-full h-full bg-[#080A12] rounded-[5px] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>
              <span className="text-sm font-bold text-white">VanishFrame</span>
            </div>
            <p className="text-slate-400 max-w-sm">
              &quot;Your Video. Cleaner Frames. Your Privacy.&quot; High-precision video overlay
              reconstruction with zero permanent storage.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center gap-6 font-medium text-slate-300">
            <a href="#workspace" className="hover:text-white transition-colors">
              Workspace
            </a>
            <a href="#workflow" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#quality" className="hover:text-white transition-colors">
              Quality Policy
            </a>
            <a href="#privacy" className="hover:text-white transition-colors">
              Privacy Architecture
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} VanishFrame. All rights reserved. Built for creator privacy.
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by FFmpeg & Next.js</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="w-3 h-3" />
              <span>Ephemeral 15m Storage</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
