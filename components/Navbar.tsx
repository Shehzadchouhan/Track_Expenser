'use client';

import React from 'react';
import { Smartphone, Sparkles, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  isPhoneLinked: boolean;
  phoneNumber?: string | null;
  onOpenPhoneModal: () => void;
}

export function Navbar({ isPhoneLinked, phoneNumber, onOpenPhoneModal }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md shadow-emerald-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Track Expenser
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              AI & WhatsApp Financial Cockpit
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {isPhoneLinked ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <Smartphone className="h-3.5 w-3.5" />
              <span>WhatsApp Active ({phoneNumber})</span>
            </div>
          ) : (
            <button
              onClick={onOpenPhoneModal}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Connect WhatsApp</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Encrypted & Idempotent</span>
          </div>
        </div>
      </div>
    </header>
  );
}
