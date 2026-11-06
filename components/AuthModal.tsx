'use client';

import React, { useState } from 'react';
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
  UserPlus,
  LogIn,
  KeyRound,
} from 'lucide-react';
import type { AppLanguage } from '@/lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (emailOrPhone: string) => void;
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

  // Active view: 'sign_in' | 'sign_up' | 'forgot_password'
  const [tab, setTab] = useState<'sign_in' | 'sign_up' | 'forgot_password'>('sign_in');

  // Form fields
  const [identifier, setIdentifier] = useState(currentUserEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Detect whether the user is typing numbers (phone) or letters (email)
  const isPhoneInput = identifier.trim().length > 0 && /^\+?[\d\s-]+$/.test(identifier.trim());

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

  // 2. Sign In or Create Account with Email / Mobile Number + Password
  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError(
        isHindi
          ? 'कृपया अपना ईमेल या 10-अंकों का मोबाइल नंबर दर्ज करें'
          : 'Please enter your email or 10-digit mobile number'
      );
      return;
    }

    if (password.length < 6) {
      setError(
        isHindi
          ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'
          : 'Password must be at least 6 characters'
      );
      return;
    }

    setLoading(true);

    try {
      const action = tab === 'sign_up' ? 'sign_up' : 'sign_in';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          identifier: cleanIdentifier,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (action === 'sign_up' ? 'Registration failed' : 'Sign in failed'));
      }

      const welcomeMsg =
        action === 'sign_up'
          ? isHindi ? 'खाता सफलतापूर्वक बन गया! स्वागत है।' : 'Account created successfully! Welcome.'
          : isHindi ? 'सफलतापूर्वक साइन इन हुआ!' : 'Signed in successfully!';

      setSuccessMsg(welcomeMsg);
      onSuccess(data.email || cleanIdentifier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Forgot Password Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = identifier.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(
        isHindi
          ? 'कृपया पासवर्ड रीसेट के लिए अपना मान्य ईमेल पता दर्ज करें'
          : 'Please enter a valid email address to reset password'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setSuccessMsg(
        isHindi
          ? `${cleanEmail} पर पासवर्ड रीसेट लिंक भेज दिया गया है। अपना इनबॉक्स चेक करें!`
          : `Password reset link sent to ${cleanEmail}. Please check your inbox!`
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
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {tab === 'forgot_password'
                  ? isHindi ? 'पासवर्ड रीसेट करें' : 'Reset Your Password'
                  : tab === 'sign_up'
                  ? isHindi ? 'नया खाता बनाएं' : 'Create New Account'
                  : isHindi ? 'साइन इन करें' : 'Sign In to Your Account'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isHindi ? 'सुरक्षित, निजी और सीधा हिसाब' : 'Simple, private, and instant'}
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

        {/* 2 Primary Tabs: Sign In vs Create Account */}
        {tab !== 'forgot_password' && (
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setTab('sign_in');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'sign_in'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{isHindi ? 'साइन इन (Sign In)' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('sign_up');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'sign_up'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{isHindi ? 'खाता बनाएं (Sign Up)' : 'Create Account'}</span>
            </button>
          </div>
        )}

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

        {/* Main Sign In / Sign Up Form */}
        {tab !== 'forgot_password' ? (
          <form onSubmit={handleSubmitAuth} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isHindi ? 'ईमेल या मोबाइल नंबर' : 'Email or Mobile Number'}
              </label>
              <div className="relative mt-1.5">
                {isPhoneInput ? (
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                )}
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    isHindi
                      ? 'उदा. 9876543210 या yourname@gmail.com'
                      : 'e.g. 9876543210 or yourname@gmail.com'
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'पासवर्ड' : 'Password'}
                </label>
                {tab === 'sign_in' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot_password');
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isHindi ? 'कम से कम 6 अक्षर' : 'At least 6 characters'}
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-10 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Helper notice */}
            {tab === 'sign_up' ? (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                {isHindi
                  ? '⚡ तुरंत चालू: किसी ईमेल लिंक या OTP का इंतज़ार नहीं, तुरंत लॉगिन होगा।'
                  : '⚡ Instant access: No waiting for email links or OTPs — instant login.'}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <span>{isHindi ? 'कृपया प्रतीक्षा करें...' : 'Please wait...'}</span>
              ) : tab === 'sign_up' ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>{isHindi ? 'खाता बनाएं (Create Account)' : 'Create Free Account'}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>{isHindi ? 'साइन इन करें (Sign In)' : 'Sign In'}</span>
                </>
              )}
            </button>

            {/* Switch between Sign In and Sign Up */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setTab(tab === 'sign_in' ? 'sign_up' : 'sign_in');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
              >
                {tab === 'sign_in'
                  ? isHindi ? 'नया खाता बनाना है? यहाँ क्लिक करें' : "Don't have an account? Create one"
                  : isHindi ? 'पहले से खाता है? साइन इन करें' : 'Already have an account? Sign In'}
              </button>
            </div>
          </form>
        ) : (
          /* Forgot Password View */
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
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {isHindi
                  ? 'हम आपको नया पासवर्ड सेट करने के लिए एक सुरक्षित लिंक भेजेंगे।'
                  : 'We will email you a secure link to reset your password.'}
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
                  setTab('sign_in');
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

        {/* Quick Instant Demo Mode at Bottom */}
        <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            disabled={loading}
            onClick={handleDemoLogin}
            className="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>{isHindi ? '⚡ 1-क्लिक टेस्ट / डेमो मोड (तुरंत देखें)' : '⚡ One-Click Demo Mode (Instant Preview)'}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
