'use client';

import { Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

interface NavbarProps {
  onCleanVideoClick: () => void;
}

export function Navbar({ onCleanVideoClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#080A12]/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/40'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[1.5px] flex items-center justify-center transition-transform group-hover:scale-105">
            <div className="w-full h-full bg-[#080A12] rounded-[6.5px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400 group-hover:text-cyan-300 transition-colors" />
            </div>
          </div>
          <span>VanishFrame</span>
        </Link>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#workspace"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Workspace
          </a>
          <a
            href="#workflow"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            How It Works
          </a>
          <a
            href="#quality"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Quality Policy
          </a>
          <a
            href="#privacy"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Privacy
          </a>
          <a
            href="#faq"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            FAQ
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onCleanVideoClick}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-500 hover:to-purple-500 shadow-md shadow-purple-900/30 transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Clean My Video
          </button>
        </div>
      </div>
    </header>
  );
}
