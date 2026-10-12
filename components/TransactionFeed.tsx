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
  Search,
  Download,
  Printer,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { exportTransactionsToCSV, printTransactionStatement } from '@/lib/export';

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
  startingBalanceRupees?: number;
}

export function TransactionFeed({
  transactions,
  onDeleteTransaction,
  onOpenAddModal,
  startingBalanceRupees = 0,
}: TransactionFeedProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'web'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multi-criteria filter
  const filtered = transactions.filter((t) => {
    // 1. Source filter
    if (sourceFilter === 'whatsapp' && t.source !== 'whatsapp_text' && t.source !== 'whatsapp_image') {
      return false;
    }
    if (sourceFilter === 'web' && t.source !== 'web') {
      return false;
    }

    // 2. Type filter
    if (typeFilter !== 'all' && t.type !== typeFilter) {
      return false;
    }

    // 3. Search query (matches merchant, note, or category)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchMerchant = t.merchant?.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchCategory = t.category_name?.toLowerCase().includes(q);
      const matchAmount = (t.amount_paise / 100).toString().includes(q);
      if (!matchMerchant && !matchNote && !matchCategory && !matchAmount) {
        return false;
      }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Transactions & Statements
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {filtered.length} of {transactions.length} entries
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export Statement CSV */}
          <button
            onClick={() => exportTransactionsToCSV(filtered)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Download CSV Statement"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Print / PDF Statement */}
          <button
            onClick={() => printTransactionStatement(filtered, startingBalanceRupees)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Print or Save PDF Statement"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

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

      {/* Search & Filter Toolbar */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, category, or note..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-1.5 pl-9 pr-8 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-100 dark:focus:bg-zinc-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter Pills (All / Expense / Income) */}
        <div className="flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            onClick={() => setTypeFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              typeFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('expense')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              typeFilter === 'expense'
                ? 'bg-white text-rose-600 shadow-2xs dark:bg-zinc-700 dark:text-rose-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setTypeFilter('income')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              typeFilter === 'income'
                ? 'bg-white text-emerald-600 shadow-2xs dark:bg-zinc-700 dark:text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Income
          </button>
        </div>

        {/* Source Filter Pills (All / WhatsApp / Web) */}
        <div className="flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            onClick={() => setSourceFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sourceFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSourceFilter('whatsapp')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sourceFilter === 'whatsapp'
                ? 'bg-white text-emerald-700 shadow-2xs dark:bg-zinc-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            WhatsApp
          </button>
          <button
            onClick={() => setSourceFilter('web')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sourceFilter === 'web'
                ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Web
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="mt-5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
            <Receipt className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              No matching transactions found.
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              {searchQuery
                ? 'Try clearing your search query or switching filters.'
                : 'Send a message or screenshot on WhatsApp to log your first transaction!'}
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
