'use client';

import React, { useState } from 'react';
import {
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Scale,
  Banknote,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { DisplayTransaction } from './TransactionFeed';
import type { AppLanguage } from '@/lib/i18n';
import type { DashboardAccount } from './AccountCards';

interface TotalBalanceCardProps {
  transactions: DisplayTransaction[];
  startingBalanceRupees: number;
  accounts?: DashboardAccount[];
  onUpdateStartingBalance: (newBalanceRupees: number) => void;
  language: AppLanguage;
}

export function TotalBalanceCard({
  transactions,
  startingBalanceRupees,
  accounts = [],
  onUpdateStartingBalance,
  language,
}: TotalBalanceCardProps) {
  const isHindi = language === 'hi';
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(startingBalanceRupees.toString());

  // Inflows & Outflows from transactions
  const totalIncomePaise = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const totalExpensePaise = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  // Compute Live Current Balance across all accounts (or starting capital + net delta)
  const startingBalancePaise = Math.round(startingBalanceRupees * 100);
  const netDeltaPaise = totalIncomePaise - totalExpensePaise;

  // If accounts exist, total balance is the sum of spending accounts
  const spendingAccounts = accounts.filter((a) => a.purpose === 'spending');
  const currentBalancePaise =
    spendingAccounts.length > 0
      ? spendingAccounts.reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0)
      : Math.max(0, startingBalancePaise + netDeltaPaise);

  // Percentage fluctuation from starting capital
  const percentChange =
    startingBalancePaise > 0
      ? Math.round((netDeltaPaise / startingBalancePaise) * 100)
      : 0;

  const handleSave = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateStartingBalance(parsed);
      setIsEditing(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Background Glow */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <Landmark className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'खाते में कुल पैसे (Net Worth)' : 'Total Liquid Balance'}
            </span>
          </div>

          {/* Current Live Balance */}
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              {formatINR(Math.max(0, currentBalancePaise), { showPaise: false })}
            </h2>

            {/* Overall Fluctuation Pill */}
            {startingBalancePaise > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  netDeltaPaise >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                {netDeltaPaise >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {netDeltaPaise >= 0 ? '+' : ''}
                  {percentChange}%
                </span>
              </span>
            )}
          </div>

          {/* Accounts Breakdown Pills */}
          {accounts.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {accounts.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {a.type === 'bank' ? '💳' : a.type === 'cash' ? '💵' : '🪙'}{' '}
                  <span>{a.name}:</span>
                  <span className="font-bold">{formatINR(Math.max(0, a.current_balance_paise), { showPaise: false })}</span>
                </span>
              ))}
            </div>
          )}

          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {isHindi
              ? 'बैंक, UPI और नकद सभी खाते शामिल हैं।'
              : 'Combined total across Bank, UPI, and Cash in Hand.'}
          </p>
        </div>

        {/* Base / Starting Balance Config */}
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/40">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-medium">₹</span>
              <input
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={isHindi ? 'शुरुआती रकम' : 'Starting balance'}
                className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 focus:outline-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setInputVal(startingBalanceRupees.toString());
                  setIsEditing(false);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">
                  {isHindi ? 'शुरुआती पूंजी' : 'Base Capital'}
                </span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {formatINR(startingBalancePaise, { showPaise: false })}
                </span>
              </div>
              <button
                onClick={() => {
                  setInputVal(startingBalanceRupees.toString());
                  setIsEditing(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-400 shadow-2xs hover:text-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200"
                title={isHindi ? 'शुरुआती पूंजी बदलें' : 'Edit Base Capital'}
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Net Summary Bar */}
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div>
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            {isHindi ? 'कुल कमाई' : 'Total Income'}
          </span>
          <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(totalIncomePaise, { showPaise: false })}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
            {isHindi ? 'कुल खर्च' : 'Total Spent'}
          </span>
          <p className="mt-1 text-base font-bold text-rose-600 dark:text-rose-400">
            {formatINR(totalExpensePaise, { showPaise: false })}
          </p>
        </div>
      </div>
    </div>
  );
}
