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

export type ResetScope = 'reset_weekly' | 'reset_monthly' | 'reset_all';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScope: 'weekly' | 'monthly' | 'all';
  onConfirmReset: (scope: ResetScope, resetStartingBalance: boolean) => Promise<void>;
}

export function ResetModal({
  isOpen,
  onClose,
  currentScope,
  onConfirmReset,
}: ResetModalProps) {
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
    } catch (err: any) {
      setError(err?.message || 'Failed to complete reset operation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScopeName = () => {
    switch (selectedScope) {
      case 'reset_weekly':
        return 'This Week';
      case 'reset_monthly':
        return 'This Month';
      case 'reset_all':
        return 'All Time History';
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
              Reset Tracking Cycle
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Clear accumulated transactions so you stay focused on your active budget without confusing numbers.
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
            Choose What to Reset
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
                    Reset Current Week
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Wipes expenses & income from Monday to today. Starts this week fresh.
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
                    Reset Current Month
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Wipes expenses & income logged in this calendar month for a clean monthly start.
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
                    Reset All History (Total Clean Slate)
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Permanently deletes all transactions recorded across all time.
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
                Also reset starting balance to ₹0
              </span>
              <p className="text-[11px] text-zinc-400">
                Clears manual starting capital so your balance begins at zero.
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
            Transactions cleared under <b>{getScopeName()}</b> will be permanently removed from your dashboard and database.
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
            Cancel
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
            <span>Confirm Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
