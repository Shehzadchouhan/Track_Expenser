'use client';

import React, { useState } from 'react';
import { Smartphone, Send, CheckCircle2, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import type { AppLanguage } from '@/lib/i18n';

interface WhatsAppLinkCardProps {
  isLinked: boolean;
  linkedPhone?: string | null;
  onSuccess: (phone: string) => void;
  language: AppLanguage;
}

export function WhatsAppLinkCard({ isLinked, linkedPhone, onSuccess, language }: WhatsAppLinkCardProps) {
  const isHindi = language === 'hi';
  const [phone, setPhone] = useState(linkedPhone || '+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>(isLinked ? 'phone' : 'phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setStep('otp');
      const hint = data.devOtp
        ? isHindi
          ? ` (परीक्षण कोड: ${data.devOtp})`
          : ` (Testing code: ${data.devOtp})`
        : '';
      setSuccessMsg(
        isHindi
          ? `WhatsApp पर ${phone} को 6 अंकों का कोड भेजा गया।${hint}`
          : `6-digit code sent to ${phone} via WhatsApp!${hint}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : isHindi ? 'कोड नहीं भेजा जा सका।' : 'Error sending code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp_code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify code');
      }

      setSuccessMsg(isHindi ? 'WhatsApp जुड़ गया!' : 'WhatsApp linked successfully!');
      onSuccess(phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : isHindi ? 'गलत कोड।' : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (isLinked) {
    return (
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 dark:border-emerald-500/10 dark:bg-emerald-950/20">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? `WhatsApp जुड़ा है: ${linkedPhone}` : `WhatsApp connected: ${linkedPhone}`}
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {isHindi
                ? 'अब WhatsApp पर संदेश या भुगतान का स्क्रीनशॉट भेजकर खर्च जोड़ें।'
                : 'Send a message or payment screenshot to your WhatsApp bot to add expenses.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                💬 <i>{isHindi ? '“चाय पर 250 रुपये खर्च”' : '"Spent 250 on tea"'}</i>
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                📸 {isHindi ? 'GPay / PhonePe का स्क्रीनशॉट भेजें' : 'Share GPay / PhonePe screenshot'}
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                ↩️ <i>{isHindi ? '“undo”' : '"undo"'}</i> {isHindi ? 'पिछला खर्च हटाएं' : 'to cancel last'}
              </span>
            </div>

            <a
              href="https://wa.me/15556319114?text=Spent%20"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 hover:scale-[1.01] active:scale-95"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{isHindi ? 'WhatsApp पर खर्च जोड़ें' : 'Open WhatsApp chat'}</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isHindi ? 'अपना WhatsApp नंबर जोड़ें' : 'Link your WhatsApp number'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isHindi ? 'बिना टाइप किए WhatsApp पर खर्च जोड़ें' : 'Add expenses through WhatsApp without typing here'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && !error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleRequestOtp} className="mt-4">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {isHindi ? 'फ़ोन नंबर (देश के कोड के साथ)' : 'Phone number (with country code)'}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              required
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm font-semibold text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{isHindi ? 'कोड भेजें' : 'Send code'}</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {isHindi ? '6 अंकों का कोड आपके WhatsApp पर भेजा जाएगा।' : 'A 6-digit verification code will be sent to your WhatsApp account.'}
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="mt-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {isHindi ? 'WhatsApp का 6 अंकों का कोड डालें' : 'Enter 6-digit WhatsApp code'}
            </label>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError(null);
              }}
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {isHindi ? 'नंबर बदलें' : 'Change number'}
            </button>
          </div>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              required
              className="w-36 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-center font-mono text-lg font-bold tracking-widest text-zinc-900 placeholder-zinc-300 transition-colors focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>{isHindi ? 'कोड जांचें और जोड़ें' : 'Verify & link'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
