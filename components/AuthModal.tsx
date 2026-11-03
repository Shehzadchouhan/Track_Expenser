'use client';

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
  KeyRound,
  UserPlus,
  LogIn,
} from 'lucide-react';
import type { AppLanguage } from '@/lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  currentUserEmail?: string | null;
  language: AppLanguage;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  currentUserEmail,
  language,
}: AuthModalProps) {
  const isHindi = language === 'hi';

  // Mode: 'password' (default, fast, no email delay), 'otp' (magic link), or 'forgot_password'
  const [authMode, setAuthMode] = useState<'password' | 'otp' | 'forgot_password'>('password');
  const [isSignUp, setIsSignUp] = useState(false);

  // Form fields
  const [email, setEmail] = useState(currentUserEmail || '');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. One-Click Instant Demo Login
  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo login failed');
      }

      onSuccess(data.email || 'demo@trackexpenser.app');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start demo session');
    } finally {
      setLoading(false);
    }
  };

  // 2. Email + Password Sign In / Sign Up
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isSignUp ? 'sign_up' : 'sign_in',
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isSignUp ? 'Registration failed' : 'Sign in failed'));
      }

      setSuccessMsg(
        isHindi
          ? isSignUp ? 'खाता सफलतापूर्वक बनाया गया!' : 'सफलतापूर्वक साइन इन हुआ!'
          : isSignUp ? 'Account created successfully!' : 'Signed in successfully!'
      );

      setTimeout(() => {
        onSuccess(email.trim());
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Passwordless Magic Link / OTP Request
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/email/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send login link');
      }

      setOtpSent(true);
      setSuccessMsg(
        isHindi
          ? `${email} पर साइन-इन लिंक भेजा गया है। अपना इनबॉक्स चेक करें!`
          : `Sign-in link sent to ${email}. Please check your inbox!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send login link.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Passwordless OTP Verify (for cases where user has a 6-digit code)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          token: otpToken.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      onSuccess(email.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Forgot Password Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setSuccessMsg(
        isHindi
          ? `${email} पर पासवर्ड रीसेट लिंक भेज दिया गया है। अपना इनबॉक्स चेक करें!`
          : `Password reset link sent to ${email}. Check your inbox to set a new password!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send password reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] sm:max-h-none overflow-y-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        {/* Glow Decor */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {isHindi ? 'ट्रैक एक्सपेंसर में साइन इन करें' : 'Sign in to Track Expenser'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isHindi ? 'आपका सुरक्षित और निजी वित्तीय खाता' : 'Secure, private, and synced'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Demo Mode Button */}
        <div className="mt-4">
          <button
            type="button"
            disabled={loading}
            onClick={handleDemoLogin}
            className="group flex w-full items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>{isHindi ? '⚡ 1-क्लिक टेस्ट / डेमो मोड (तुरंत लॉगिन)' : '⚡ One-Click Demo Mode (Instant Login)'}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Auth Method Selector */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              authMode === 'password' || authMode === 'forgot_password'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isHindi ? 'ईमेल और पासवर्ड' : 'Email & Password'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('otp');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              authMode === 'otp'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>{isHindi ? 'मैजिक लिंक / OTP' : 'Magic Link / OTP'}</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: Email + Password */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordAuth} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isHindi ? 'ईमेल पता' : 'Email Address'}
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'पासवर्ड' : 'Password'}
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot_password');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {isHindi ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <span>{isHindi ? 'सत्यापित हो रहा है...' : 'Authenticating...'}</span>
              ) : isSignUp ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>{isHindi ? 'नया खाता बनाएं' : 'Create Free Account'}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>{isHindi ? 'साइन इन करें' : 'Sign In'}</span>
                </>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp((prev) => !prev);
                  setError(null);
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
              >
                {isSignUp
                  ? isHindi ? 'पहले से खाता है? साइन इन करें' : 'Already have an account? Sign in'
                  : isHindi ? 'नया खाता बनाना है? यहाँ क्लिक करें' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: Forgot Password */}
        {authMode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isHindi ? 'पंजीकृत ईमेल पता' : 'Registered Email Address'}
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {isHindi
                  ? 'हम आपको नया पासवर्ड सेट करने के लिए एक सुरक्षित लिंक भेजेंगे।'
                  : 'We will email you a secure link to reset and choose a new password.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <span>{isHindi ? 'भेजा जा रहा है...' : 'Sending link...'}</span>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>{isHindi ? 'पासवर्ड रीसेट लिंक भेजें' : 'Send Password Reset Link'}</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
              >
                {isHindi ? '← वापस साइन इन पर जाएं' : '← Back to Sign In'}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: Passwordless Magic Link / OTP */}
        {authMode === 'otp' && (
          <div className="mt-5 space-y-4">
            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {isHindi ? 'ईमेल पता' : 'Email Address'}
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {isHindi
                      ? 'हम आपके ईमेल पर 1-क्लिक साइन-इन लिंक भेजेंगे (पासवर्ड की जरूरत नहीं)।'
                      : 'We will send a 1-click sign-in link to your email (no password needed).'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  <span>
                    {loading
                      ? isHindi ? 'भेजा जा रहा है...' : 'Sending link...'
                      : isHindi ? 'साइन-इन लिंक भेजें' : 'Send Sign-In Link'}
                  </span>
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Visual Check Your Email Card */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center dark:bg-emerald-950/20">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {isHindi ? 'अपना ईमेल चेक करें!' : 'Check your email!'}
                  </h4>
                  <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {isHindi
                      ? 'ईमेल खोलें और तुरंत लॉगिन करने के लिए "Sign in" बटन पर क्लिक करें।'
                      : 'Open your email and click the "Sign in" link to log in immediately.'}
                  </p>
                </div>

                {/* Optional 6-digit code entry if received */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 text-center">
                    {isHindi ? 'या अगर आपको 6-अंकीय कोड मिला है, तो यहाँ दर्ज करें:' : 'Or if you received a 6-digit code, enter it below:'}
                  </p>
                  <form onSubmit={handleVerifyOtp} className="mt-2.5 space-y-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-xl border border-zinc-200 bg-white py-2 text-center font-mono text-base font-bold tracking-widest text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      disabled={loading || otpToken.length < 6}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{loading ? '...' : isHindi ? 'कोड से साइन इन करें' : 'Verify Code & Sign In'}</span>
                    </button>
                  </form>
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-zinc-500 hover:underline"
                  >
                    {isHindi ? 'ईमेल बदलें' : 'Change email'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleRequestOtp}
                    className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {isHindi ? 'दोबारा लिंक भेजें' : 'Resend link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
