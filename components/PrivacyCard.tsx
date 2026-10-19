'use client';

import {
  FileLock,
  HardDrive,
  KeyRound,
  Shield,
  Trash2,
} from 'lucide-react';
import React from 'react';

export function PrivacyCard() {
  return (
    <section id="privacy" className="py-16 sm:py-24 border-t border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy-First Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ephemeral Storage by Design.
          </h2>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            We believe your creative assets belong solely to you. VanishFrame does not maintain
            permanent video storage or user content databases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#101322] border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4">
              <HardDrive className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No Persistent Object Storage</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Videos are stored strictly in temporary operating system directories with randomized identifiers.
              No cloud buckets, no long-term databases, and no content telemetry.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#101322] border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Cryptographic Capability Tokens</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every job generates an isolated 24-byte crypto token. Only the browser session with this token
              can inspect or download the reconstructed video file.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#101322] border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Server-Enforced Auto-Purge</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Temporary files are wiped automatically by a background cleanup daemon after 15 minutes,
              or immediately when you click Cancel or reset your session.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
