'use client';

import React from 'react';
import { PieChart } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { categoryLabel, type AppLanguage } from '@/lib/i18n';

export interface CategorySpendItem {
  id: string;
  name: string;
  color: string;
  spendPaise: number;
  count: number;
}

interface CategoryBreakdownProps {
  categories: CategorySpendItem[];
  totalSpendPaise: number;
  language: AppLanguage;
}

export function CategoryBreakdown({ categories, totalSpendPaise, language }: CategoryBreakdownProps) {
  const isHindi = language === 'hi';
  // Sort descending by spend
  const sorted = [...categories].sort((a, b) => b.spendPaise - a.spendPaise);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <PieChart className="h-4 w-4" />
          </span>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isHindi ? 'खर्च का बंटवारा' : 'Category Breakdown'}
          </h3>
        </div>
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {isHindi ? 'कुल:' : 'Total:'} {formatINR(totalSpendPaise, { showPaise: false })}
        </span>
      </div>

      <div className="mt-5 space-y-3.5">
        {sorted.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 py-6">
            {isHindi ? 'इस महीने कोई खर्च दर्ज नहीं है।' : 'No category spend recorded this month.'}
          </p>
        ) : (
          sorted.map((item) => {
            const percentage =
              totalSpendPaise > 0
                ? Math.round((item.spendPaise / totalSpendPaise) * 100)
                : 0;

            return (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {categoryLabel(item.name, language)}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      ({item.count} {isHindi ? 'लेन-देन' : item.count === 1 ? 'record' : 'records'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {formatINR(item.spendPaise, { showPaise: false })}
                    </span>
                    <span className="w-8 text-right text-[11px] text-zinc-400">
                      {percentage}%
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
