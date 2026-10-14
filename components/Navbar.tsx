'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  MessageCircle,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Logo } from './Logo';
import type { AppLanguage } from '@/lib/i18n';
import { Languages } from 'lucide-react';

interface NavbarProps {
  isPhoneLinked: boolean;
  phoneNumber?: string | null;
  onOpenPhoneModal: () => void;
  onSignOut: () => void;
  onOpenResetModal?: () => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}

export function Navbar({
  isPhoneLinked,
  phoneNumber,
  onOpenPhoneModal,
  onSignOut,
  onOpenResetModal,
  language,
  onLanguageChange,
}: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // WhatsApp bot direct link
  const botWhatsAppUrl = 'https://wa.me/15556319114?text=Spent%20';
  const isHindi = language === 'hi';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Logo className="hidden sm:flex" size="md" language={language} />
        <Logo className="sm:hidden" size="sm" showText={false} language={language} />

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Quick One-Tap WhatsApp Bot Trigger */}
          <a
            href={botWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 hover:scale-[1.02] active:scale-95 sm:px-3.5"
            title={isHindi ? 'खर्च जोड़ने के लिए WhatsApp खोलें' : 'Open WhatsApp to record an expense'}
            aria-label={isHindi ? 'WhatsApp में खर्च दर्ज करें' : 'Open WhatsApp to record an expense'}
          >
            <MessageCircle className="h-3.5 w-3.5 fill-white text-emerald-600" />
            <span className="hidden sm:inline">{isHindi ? 'WhatsApp पर खर्च जोड़ें' : 'Chat on WhatsApp'}</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={() => onLanguageChange(isHindi ? 'en' : 'hi')}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:px-3"
            aria-label={isHindi ? 'Switch language to English' : 'भाषा हिंदी में बदलें'}
            title={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
          >
            <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isHindi ? 'English' : 'हिन्दी'}</span>
          </button>

          {/* Reset Action Button (Quick Access) */}
          {onOpenResetModal && (
            <button
              onClick={onOpenResetModal}
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title={isHindi ? 'इस सप्ताह या महीने का हिसाब साफ़ करें' : 'Reset weekly or monthly cycle'}
            >
              <RotateCcw className="h-3 w-3 text-amber-500" />
              <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
            </button>
          )}

          {/* Phone Link / User Account Menu */}
          {isPhoneLinked ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden font-semibold sm:inline">{phoneNumber}</span>
                <ChevronDown className="hidden h-3 w-3 opacity-60 sm:block" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 z-50">
                  <div className="border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                      {isHindi ? 'चालू खाता' : 'Active Account'}
                    </span>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {phoneNumber}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenPhoneModal();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{isHindi ? 'खाता बदलें / साइन इन' : 'Switch Account / Sign In'}</span>
                    </button>

                    {onOpenResetModal && (
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenResetModal();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-amber-600 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{isHindi ? 'हिसाब रीसेट करें' : 'Reset Tracking Cycle'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onSignOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{isHindi ? 'साइन आउट' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenPhoneModal}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{isHindi ? 'साइन इन' : 'Sign in'}</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>{isHindi ? 'AI सुविधा' : 'AI tools'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
