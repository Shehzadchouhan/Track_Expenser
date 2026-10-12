'use client';

import React from 'react';
import { Smartphone, ShieldCheck, MessageCircle } from 'lucide-react';
import { Logo } from './Logo';

interface NavbarProps {
  isPhoneLinked: boolean;
  phoneNumber?: string | null;
  onOpenPhoneModal: () => void;
}

export function Navbar({ isPhoneLinked, phoneNumber, onOpenPhoneModal }: NavbarProps) {
  // WhatsApp bot direct link
  const botWhatsAppUrl = 'https://wa.me/15556319114?text=Spent%20';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* New Brand Logo */}
        <Logo size="md" />

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Quick One-Tap WhatsApp Bot Trigger */}
          <a
            href={botWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 hover:scale-[1.02] active:scale-95"
            title="Open WhatsApp chat to send expenses or payment screenshots"
          >
            <MessageCircle className="h-3.5 w-3.5 fill-white text-emerald-600" />
            <span className="hidden sm:inline">Chat on WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>

          {/* Phone Link Status */}
          {isPhoneLinked ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Linked:</span>
              <span className="font-semibold">{phoneNumber}</span>
            </div>
          ) : (
            <button
              onClick={onOpenPhoneModal}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Link Account</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>AI Multimodal</span>
          </div>
        </div>
      </div>
    </header>
  );
}
