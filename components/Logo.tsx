'use client';

import React from 'react';
import Image from 'next/image';
import type { AppLanguage } from '@/lib/i18n';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  language?: AppLanguage;
}

export function Logo({ size = 'md', showText = true, className = '', language = 'en' }: LogoProps) {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/favicon.png"
        alt="Track Expenser"
        width={768}
        height={768}
        className={`${iconSizes[size]} shrink-0 rounded-2xl shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105`}
      />

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 ${textSizes[size]}`}
            >
              Track<span className="text-emerald-500">Expenser</span>
            </span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              {language === 'hi' ? 'आसान' : 'Easy'}
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {language === 'hi' ? 'आसान खर्च हिसाब' : 'Easy money tracker'}
          </span>
        </div>
      )}
    </div>
  );
}
