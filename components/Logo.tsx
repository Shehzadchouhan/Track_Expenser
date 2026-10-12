'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
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
      {/* Geometric SVG Emblem */}
      <div
        className={`relative flex ${iconSizes[size]} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-0.5 shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105`}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-zinc-950/20 backdrop-blur-xs">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-3/4 w-3/4"
          >
            <defs>
              <linearGradient id="teGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#A7F3D0" />
              </linearGradient>
              <linearGradient id="teGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#6EE7B7" />
              </linearGradient>
            </defs>

            {/* Geometric Financial Waveform & "T" / "E" Crest */}
            {/* Top Bar (T) */}
            <path
              d="M8 12C8 10.8954 8.89543 10 10 10H30C31.1046 10 32 10.8954 32 12C32 13.1046 31.1046 14 30 14H10C8.89543 14 8 13.1046 8 12Z"
              fill="url(#teGrad1)"
            />

            {/* Center Pillar */}
            <path
              d="M17 14H23V27C23 27.5523 22.5523 28 22 28H18C17.4477 28 17 27.5523 17 27V14Z"
              fill="url(#teGrad1)"
              fillOpacity="0.9"
            />

            {/* Dynamic Upward Trend Chevron / Delta Arrow */}
            <path
              d="M12 25L20 17L28 25L26 27L20 21L14 27L12 25Z"
              fill="url(#teGrad2)"
            />

            {/* Glowing Financial Pulse Dot */}
            <circle cx="28" cy="11" r="2.5" fill="#FDE047" />
            <circle cx="28" cy="11" r="4.5" stroke="#FDE047" strokeOpacity="0.4" strokeWidth="1" />
          </svg>
        </div>
      </div>

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
              v2 AI
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            WhatsApp & Live Balance Cockpit
          </span>
        </div>
      )}
    </div>
  );
}
