'use client';

import React, { useState } from 'react';
import { Wallet, Calendar, TrendingDown, AlertTriangle, CheckCircle2, Edit3 } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { BudgetPulseResult } from '@/lib/budget';

interface SafeToSpendCardProps {
  pulse: BudgetPulseResult;
  onUpdateBudget: (newBudgetRupees: number) => Promise<void>;
}

export function SafeToSpendCard({ pulse, onUpdateBudget }: SafeToSpendCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(
    pulse.monthlyBudgetPaise > 0 ? (pulse.monthlyBudgetPaise / 100).toString() : '25000'
  );
  const [loading, setLoading] = useState(false);

  const handleSaveBudget = async () => {
    const val = parseFloat(budgetInput);
    if (!Number.isFinite(val) || val <= 0) return;
    setLoading(true);
    try {
      await onUpdateBudget(val);
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const todayPercentage =
    pulse.dailySafeAllowancePaise > 0
      ? Math.min(100, Math.round((pulse.spentTodayPaise / pulse.dailySafeAllowancePaise) * 100))
      : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50/50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950/50">
      {/* Background Accent Blur */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Daily Burn-Rate Cockpit
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {formatINR(pulse.remainingTodayPaise, { showPaise: false })}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Safe to spend for the rest of today
          </p>
        </div>

        {/* Status Indicator */}
        <div>
          {pulse.isOverBudget ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Budget Blown
            </span>
          ) : pulse.remainingTodayPaise === 0 && pulse.monthlyBudgetPaise > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <TrendingDown className="h-3.5 w-3.5" />
              Daily Limit Reached
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              On Track
            </span>
          )}
        </div>
      </div>

      {/* Progress Gauge */}
      {pulse.monthlyBudgetPaise > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>Today's Allowance Used</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-200">
              {formatINR(pulse.spentTodayPaise, { showPaise: false })} /{' '}
              {formatINR(pulse.dailySafeAllowancePaise, { showPaise: false })} ({todayPercentage}%)
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                todayPercentage >= 100
                  ? 'bg-rose-500'
                  : todayPercentage > 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${todayPercentage}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No monthly spending limit configured. Set your monthly target to calculate your daily pace!
          </p>
        </div>
      )}

      {/* 3 Metrics Row */}
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <div className="rounded-xl bg-zinc-100/60 p-3 dark:bg-zinc-800/40">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Spent Today
          </span>
          <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {formatINR(pulse.spentTodayPaise, { showPaise: false })}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-100/60 p-3 dark:bg-zinc-800/40">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Month Remaining
          </span>
          <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {formatINR(pulse.monthRemainingPaise, { showPaise: false })}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-100/60 p-3 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Days Left
            </span>
            <Calendar className="h-3 w-3 text-zinc-400" />
          </div>
          <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {pulse.daysRemainingInMonth} days
          </p>
        </div>
      </div>

      {/* Edit Monthly Budget Section */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
        <div className="text-zinc-500 dark:text-zinc-400">
          Monthly Target:{' '}
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {pulse.monthlyBudgetPaise > 0
              ? formatINR(pulse.monthlyBudgetPaise, { showPaise: false })
              : 'Not set'}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="₹ amount"
            />
            <button
              onClick={handleSaveBudget}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              {loading ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            <Edit3 className="h-3 w-3" />
            <span>Adjust Target</span>
          </button>
        )}
      </div>
    </div>
  );
}
