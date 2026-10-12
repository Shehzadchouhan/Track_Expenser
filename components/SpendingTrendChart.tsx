'use client';

import React from 'react';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { DisplayTransaction } from './TransactionFeed';

interface SpendingTrendChartProps {
  transactions: DisplayTransaction[];
  dailyAllowancePaise?: number;
}

export function SpendingTrendChart({
  transactions,
  dailyAllowancePaise = 0,
}: SpendingTrendChartProps) {
  // Generate the last 7 days (day 0 = today, day 6 = 6 days ago)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dailyData = days.map((dayDate) => {
    const nextDay = new Date(dayDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayExpenses = transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      const txDate = new Date(t.occurred_at);
      return txDate >= dayDate && txDate < nextDay;
    });

    const totalPaise = dayExpenses.reduce((sum, t) => sum + t.amount_paise, 0);
    const dayLabel = dayDate.toLocaleDateString('en-IN', { weekday: 'short' });
    const isToday = dayDate.toDateString() === new Date().toDateString();

    return {
      date: dayDate,
      dayLabel: isToday ? 'Today' : dayLabel,
      totalPaise,
      isToday,
      count: dayExpenses.length,
    };
  });

  // Calculate max amount for proportional height
  const maxSpendPaise = Math.max(
    ...dailyData.map((d) => d.totalPaise),
    dailyAllowancePaise,
    100000 // Minimum scale ₹1,000 to keep it balanced
  );

  const total7DaysSpendPaise = dailyData.reduce((sum, d) => sum + d.totalPaise, 0);
  const avgDailySpendPaise = Math.round(total7DaysSpendPaise / 7);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              7-Day Spend Activity
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Daily burn rate & weekly momentum
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">7-Day Total</span>
          <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
            {formatINR(total7DaysSpendPaise, { showPaise: false })}
          </span>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="mt-6 flex h-36 items-end justify-between gap-2 pt-6">
        {dailyData.map((day, idx) => {
          const heightPercent = Math.min(100, Math.max(8, (day.totalPaise / maxSpendPaise) * 100));
          const isOverDaily = dailyAllowancePaise > 0 && day.totalPaise > dailyAllowancePaise;

          return (
            <div key={idx} className="group relative flex flex-1 flex-col items-center h-full justify-end">
              {/* Tooltip on Hover */}
              <div className="pointer-events-none absolute -top-10 z-20 hidden rounded-xl bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg transition-all group-hover:flex dark:bg-zinc-100 dark:text-zinc-900">
                {formatINR(day.totalPaise, { showPaise: false })}
              </div>

              {/* Bar */}
              <div
                className={`w-full max-w-[36px] rounded-t-xl transition-all duration-500 ${
                  day.isToday
                    ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/20'
                    : isOverDaily
                    ? 'bg-amber-400 dark:bg-amber-500'
                    : day.totalPaise > 0
                    ? 'bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                    : 'bg-zinc-100 dark:bg-zinc-800'
                }`}
                style={{ height: `${heightPercent}%` }}
              />

              {/* Day Label */}
              <span
                className={`mt-2 text-[11px] font-medium ${
                  day.isToday
                    ? 'font-bold text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {day.dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Summary Strip */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
          <span>Avg: <strong className="text-zinc-800 dark:text-zinc-200">{formatINR(avgDailySpendPaise, { showPaise: false })}/day</strong></span>
        </span>

        {dailyAllowancePaise > 0 && (
          <span className="flex items-center gap-1 text-[11px]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Target: {formatINR(dailyAllowancePaise, { showPaise: false })}</span>
          </span>
        )}
      </div>
    </div>
  );
}
