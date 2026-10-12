'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  Camera,
  Globe,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Receipt,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

export interface DisplayTransaction {
  id: string;
  type: 'income' | 'expense';
  amount_paise: number;
  merchant?: string | null;
  note?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  source: 'web' | 'whatsapp_text' | 'whatsapp_image';
  occurred_at: string;
}

interface TransactionFeedProps {
  transactions: DisplayTransaction[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
}

export function TransactionFeed({
  transactions,
  onDeleteTransaction,
  onOpenAddModal,
}: TransactionFeedProps) {
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'web'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = transactions.filter((t) => {
    if (filter === 'whatsapp') {
      return t.source === 'whatsapp_text' || t.source === 'whatsapp_image';
    }
    if (filter === 'web') {
      return t.source === 'web';
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteTransaction(id);
    } finally {
      setDeletingId(null);
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'whatsapp_text':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Smartphone className="h-2.5 w-2.5" />
            WhatsApp
          </span>
        );
      case 'whatsapp_image':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <Camera className="h-2.5 w-2.5" />
            Screenshot
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <Globe className="h-2.5 w-2.5" />
            Web
          </span>
        );
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Feed Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Transactions Feed
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Auto-synced from WhatsApp and web
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                filter === 'all'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('whatsapp')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                filter === 'whatsapp'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              WhatsApp
            </button>
            <button
              onClick={() => setFilter('web')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                filter === 'web'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Web
            </button>
          </div>

          {/* Quick Add Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="mt-5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
            <Receipt className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              No transactions found.
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              Send a message on WhatsApp or click "Add" above to log your first expense!
            </p>
          </div>
        ) : (
          filtered.map((tx) => {
            const isExpense = tx.type === 'expense';
            const dateStr = new Date(tx.occurred_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={tx.id}
                className="group flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3.5 transition hover:border-zinc-200 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-800/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
              >
                {/* Left: Icon & Details */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isExpense
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}
                  >
                    {isExpense ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {tx.merchant || tx.note || (isExpense ? 'Expense' : 'Income')}
                      </span>
                      {getSourceBadge(tx.source)}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {tx.category_name && (
                        <span className="flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: tx.category_color || '#64748B' }}
                          />
                          {tx.category_name}
                        </span>
                      )}
                      <span>•</span>
                      <span suppressHydrationWarning>{dateStr}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Delete */}
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-bold tracking-tight ${
                      isExpense
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatINR(tx.amount_paise, { showPaise: false })}
                  </span>

                  <button
                    onClick={() => handleDelete(tx.id)}
                    disabled={deletingId === tx.id}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-600 text-zinc-400 p-1 rounded-lg"
                    title="Delete Transaction"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
