'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  Lock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { AppLanguage } from '@/lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (phone: string) => void;
  currentPhone?: string | null;
  language: AppLanguage;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  currentPhone,
  language,
}: AuthModalProps) {
  const isHindi = language === 'hi';
  const [phone, setPhone] = useState(currentPhone || '+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone.trim() }),
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
          : `6-digit verification code sent to ${phone} via WhatsApp!${hint}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi ? 'कोड नहीं भेजा जा सका। नंबर जांचें।' : 'Error sending code. Please check your number.'
      );
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
        body: JSON.stringify({
          phone_number: phone.trim(),
          otp_code: otp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setSuccessMsg(isHindi ? 'साइन इन हो गया!' : 'Signed in successfully!');
      onSuccess(phone.trim());
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi ? 'कोड जांचें और फिर कोशिश करें।' : 'Verification failed. Please check the code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {isHindi ? currentPhone ? 'खाता बदलें' : 'साइन इन / रजिस्टर करें' : currentPhone ? 'Switch account' : 'Sign in / register'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'बिना पासवर्ड के अपने खर्चों का हिसाब रखें।' : 'Access your personal expense tracker without a password.'}
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && !error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Body */}
        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isHindi ? 'WhatsApp फ़ोन नंबर' : 'WhatsApp phone number'}
              </label>
              <div className="relative mt-1.5">
                <Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {isHindi
                  ? 'देश का कोड जोड़ें (भारत के लिए +91)। नए उपयोगकर्ता का खाता अपने आप बनेगा।'
                  : 'Include country code (e.g. +91 for India). New users get an account automatically.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || phone.trim().length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>{isHindi ? 'WhatsApp से आगे बढ़ें' : 'Continue with WhatsApp'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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

            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                autoFocus
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-4 text-center font-mono text-xl font-bold tracking-widest text-zinc-900 placeholder-zinc-300 transition-colors focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{isHindi ? 'कोड जांचें और साइन इन करें' : 'Verify & sign in'}</span>
            </button>

            <div className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
              {isHindi ? (
                <span>
                  WhatsApp पर कोड नहीं मिला?{' '}
                  <a
                    href="https://wa.me/15556319114?text=Hi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-600 underline dark:text-emerald-400"
                  >
                    बॉट को WhatsApp पर Hi भेजें
                  </a>
                </span>
              ) : (
                <span>
                  Didn&apos;t receive it on WhatsApp?{' '}
                  <a
                    href="https://wa.me/15556319114?text=Hi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-600 underline dark:text-emerald-400"
                  >
                    Click to say &quot;Hi&quot; to the Bot
                  </a>{' '}
                  to activate.
                </span>
              )}
            </div>
          </form>
        )}

        {/* Feature Highlights Footer */}
        <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>{isHindi ? 'सुरक्षित और बिना पासवर्ड' : 'Secure & passwordless'}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {isHindi
              ? 'WhatsApp पर संदेश या भुगतान का स्क्रीनशॉट भेजें, वे यहां दिखेंगे।'
              : 'Send messages or payment screenshots to the WhatsApp bot to see them here.'}
          </p>
        </div>
      </div>
    </div>
  );
}
