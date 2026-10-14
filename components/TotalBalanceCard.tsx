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
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { DisplayTransaction } from './TransactionFeed';
import type { AppLanguage } from '@/lib/i18n';

interface TotalBalanceCardProps {
  transactions: DisplayTransaction[];
  startingBalanceRupees: number;
  onUpdateStartingBalance: (newBalanceRupees: number) => void;
  language: AppLanguage;
}

export function TotalBalanceCard({
  transactions,
  startingBalanceRupees,
  onUpdateStartingBalance,
  language,
}: TotalBalanceCardProps) {
  const isHindi = language === 'hi';
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(startingBalanceRupees.toString());

  // 1. Calculate Inflows & Outflows from transactions
  const totalIncomePaise = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const totalExpensePaise = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  // 2. Compute Live Current Balance
  const startingBalancePaise = Math.round(startingBalanceRupees * 100);
  const netDeltaPaise = totalIncomePaise - totalExpensePaise;
  const currentBalancePaise = startingBalancePaise + netDeltaPaise;

  // 3. Compute Today's Fluctuation
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayIncomePaise = transactions
    .filter((t) => t.type === 'income' && new Date(t.occurred_at) >= todayStart)
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const todayExpensePaise = transactions
    .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= todayStart)
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const todayDeltaPaise = todayIncomePaise - todayExpensePaise;

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
              {isHindi ? 'खाते में कुल पैसे' : 'Total account balance'}
            </span>
          </div>

          {/* Current Live Balance */}
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              {formatINR(currentBalancePaise, { showPaise: false })}
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

          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {isHindi ? 'WhatsApp और आपके जोड़े हुए सभी लेन-देन शामिल हैं।' : 'Includes WhatsApp payments and records you add.'}
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
                className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-500"
                title={isHindi ? 'शुरुआती रकम सेव करें' : 'Save starting balance'}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                title={isHindi ? 'रद्द करें' : 'Cancel'}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <span className="text-[10px] text-zinc-400 block font-medium">{isHindi ? 'शुरुआती रकम' : 'Starting amount'}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {startingBalanceRupees > 0
                    ? formatINR(startingBalancePaise, { showPaise: false })
                    : isHindi ? '₹0 (रकम जोड़ें)' : '₹0 (set amount)'}
                </span>
              </div>
              <button
                onClick={() => {
                  setInputVal(startingBalanceRupees.toString());
                  setIsEditing(true);
                }}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title={isHindi ? 'शुरुआती रकम बदलें' : 'Edit starting balance'}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Fluctuation Tickers */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Total Inflow */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5 dark:border-emerald-950/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span>{isHindi ? 'कुल कमाई' : 'Total income'}</span>
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <p className="mt-1 text-lg font-bold text-emerald-900 dark:text-emerald-300">
            +{formatINR(totalIncomePaise, { showPaise: false })}
          </p>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70">
            +{formatINR(todayIncomePaise, { showPaise: false })} {isHindi ? 'आज' : 'today'}
          </span>
        </div>

        {/* Total Outflow */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 dark:border-rose-950/40 dark:bg-rose-950/20">
          <div className="flex items-center justify-between text-xs font-medium text-rose-700 dark:text-rose-400">
            <span>{isHindi ? 'कुल खर्च' : 'Total spent'}</span>
            <ArrowDownRight className="h-4 w-4" />
          </div>
          <p className="mt-1 text-lg font-bold text-rose-900 dark:text-rose-300">
            -{formatINR(totalExpensePaise, { showPaise: false })}
          </p>
          <span className="text-[10px] text-rose-600/80 dark:text-rose-400/70">
            -{formatINR(todayExpensePaise, { showPaise: false })} {isHindi ? 'आज' : 'today'}
          </span>
        </div>

        {/* Net Fluctuation */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/30">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <span>{isHindi ? 'बचा हुआ फ़र्क' : 'Net change'}</span>
            <Scale className="h-4 w-4" />
          </div>
          <p
            className={`mt-1 text-lg font-bold ${
              netDeltaPaise >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netDeltaPaise >= 0 ? '+' : ''}
            {formatINR(netDeltaPaise, { showPaise: false })}
          </p>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {isHindi ? 'आज:' : 'Today:'} {todayDeltaPaise >= 0 ? '+' : ''}
            {formatINR(todayDeltaPaise, { showPaise: false })}
          </span>
        </div>
      </div>
    </div>
  );
}
