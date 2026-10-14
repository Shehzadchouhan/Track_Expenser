'use client';

import React, { useState } from 'react';
import {
  RotateCcw,
  Calendar,
  CalendarDays,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { AppLanguage } from '@/lib/i18n';

export type ResetScope = 'reset_weekly' | 'reset_monthly' | 'reset_all';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScope: 'weekly' | 'monthly' | 'all';
  onConfirmReset: (scope: ResetScope, resetStartingBalance: boolean) => Promise<void>;
  language: AppLanguage;
}

export function ResetModal({
  isOpen,
  onClose,
  currentScope,
  onConfirmReset,
  language,
}: ResetModalProps) {
  const isHindi = language === 'hi';
  const [selectedScope, setSelectedScope] = useState<ResetScope>(
    currentScope === 'weekly'
      ? 'reset_weekly'
      : currentScope === 'all'
      ? 'reset_all'
      : 'reset_monthly'
  );
  const [resetBalance, setResetBalance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmReset(selectedScope, resetBalance);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi ? 'हिसाब रीसेट नहीं हुआ। फिर से कोशिश करें।' : 'Failed to reset transactions.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScopeName = () => {
    switch (selectedScope) {
      case 'reset_weekly':
        return isHindi ? 'इस सप्ताह' : 'This Week';
      case 'reset_monthly':
        return isHindi ? 'इस महीने' : 'This Month';
      case 'reset_all':
        return isHindi ? 'पूरा हिसाब' : 'All-time history';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {isHindi ? 'लेन-देन का हिसाब रीसेट करें' : 'Reset transaction history'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'चुने हुए समय के लेन-देन हटाएं। यह बदलाव वापस नहीं होगा।' : 'Remove transactions for the selected period. This cannot be undone.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scope Selection Options */}
        <div className="mt-5 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {isHindi ? 'क्या रीसेट करना है?' : 'Choose what to reset'}
          </label>

          {/* 1. Reset Weekly */}
          <div
            onClick={() => setSelectedScope('reset_weekly')}
            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
              selectedScope === 'reset_weekly'
                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500 dark:bg-emerald-950/30'
                : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selectedScope === 'reset_weekly'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {isHindi ? 'इस सप्ताह का हिसाब' : 'Reset this week'}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isHindi ? 'सोमवार से आज तक के खर्च और कमाई हटाएं।' : 'Remove expenses and income from Monday through today.'}
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="scope"
                checked={selectedScope === 'reset_weekly'}
                onChange={() => setSelectedScope('reset_weekly')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 2. Reset Monthly */}
          <div
            onClick={() => setSelectedScope('reset_monthly')}
            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
              selectedScope === 'reset_monthly'
                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500 dark:bg-emerald-950/30'
                : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selectedScope === 'reset_monthly'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {isHindi ? 'इस महीने का हिसाब' : 'Reset this month'}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isHindi ? 'इस महीने के खर्च और कमाई हटाएं।' : 'Remove expenses and income recorded this month.'}
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="scope"
                checked={selectedScope === 'reset_monthly'}
                onChange={() => setSelectedScope('reset_monthly')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 3. Reset All Time */}
          <div
            onClick={() => setSelectedScope('reset_all')}
            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
              selectedScope === 'reset_all'
                ? 'border-rose-500 bg-rose-50/40 dark:border-rose-500 dark:bg-rose-950/30'
                : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selectedScope === 'reset_all'
                      ? 'bg-rose-500 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {isHindi ? 'पूरा हिसाब हटाएं' : 'Reset all history'}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isHindi ? 'अब तक के सभी लेन-देन हमेशा के लिए हटेंगे।' : 'Permanently delete all transactions.'}
                  </p>
                </div>
              </div>
              <input
                type="radio"
                name="scope"
                checked={selectedScope === 'reset_all'}
                onChange={() => setSelectedScope('reset_all')}
                className="mt-1 text-rose-600 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Optional Starting Balance Reset */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-zinc-500" />
            <div>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {isHindi ? 'शुरुआती रकम भी ₹0 करें' : 'Also reset starting balance to ₹0'}
              </span>
              <p className="text-[11px] text-zinc-400">
                {isHindi ? 'आपके खाते की दिखाई गई रकम शून्य हो जाएगी।' : 'Your displayed account balance will start at zero.'}
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={resetBalance}
            onChange={(e) => setResetBalance(e.target.checked)}
            className="h-4 w-4 rounded-sm border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
        </div>

        {/* Warning Badge */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isHindi
              ? <><b>{getScopeName()}</b> के लेन-देन हमेशा के लिए हट जाएंगे।</>
              : <>Transactions under <b>{getScopeName()}</b> will be permanently removed.</>}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isHindi ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={isSubmitting}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              selectedScope === 'reset_all'
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            <span>{isHindi ? 'हां, रीसेट करें' : 'Confirm reset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
