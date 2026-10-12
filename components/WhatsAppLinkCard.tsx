'use client';

import React, { useState } from 'react';
import { Smartphone, Send, CheckCircle2, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';

interface WhatsAppLinkCardProps {
  isLinked: boolean;
  linkedPhone?: string | null;
  onSuccess: (phone: string) => void;
}

export function WhatsAppLinkCard({ isLinked, linkedPhone, onSuccess }: WhatsAppLinkCardProps) {
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
      setSuccessMsg(`6-digit code sent to ${phone} via WhatsApp!`);
    } catch (err: any) {
      setError(err.message || 'Error sending code');
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

      setSuccessMsg('WhatsApp linked successfully!');
      onSuccess(phone);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
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
              WhatsApp Active: {linkedPhone}
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Your number is authenticated. You can log expenses by texting your WhatsApp bot anytime!
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                💬 <i>"Spent 250 on tea"</i>
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                📸 Share GPay / PhonePe screenshot
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                ↩️ <i>"undo"</i> to cancel last
              </span>
            </div>
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
            Link Your WhatsApp Number
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Log expenses instantly via WhatsApp with zero manual entry
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
            Phone Number (with Country Code)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              required
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
              <span>Send OTP</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            A 6-digit verification code will be sent to your WhatsApp account.
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="mt-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Enter 6-digit WhatsApp Code
            </label>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError(null);
              }}
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Change number
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
              className="w-36 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-center text-lg font-mono font-bold tracking-widest text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
              <span>Verify & Link</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
