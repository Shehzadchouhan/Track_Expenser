'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  Camera,
  Globe,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Plus,
  Receipt,
  Search,
  Download,
  Printer,
  X,
  RotateCcw,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { exportTransactionsToCSV, printTransactionStatement } from '@/lib/export';
import { categoryLabel, type AppLanguage } from '@/lib/i18n';

export interface DisplayTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount_paise: number;
  account_id?: string | null;
  account_name?: string | null;
  transfer_to_account_id?: string | null;
  transfer_to_account_name?: string | null;
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
  onOpenResetModal?: () => void;
  startingBalanceRupees?: number;
  simpleMode?: boolean;
  onShowAllTransactions?: () => void;
  language: AppLanguage;
}

export function TransactionFeed({
  transactions,
  onDeleteTransaction,
  onOpenAddModal,
  onOpenResetModal,
  startingBalanceRupees = 0,
  simpleMode = false,
  onShowAllTransactions,
  language,
}: TransactionFeedProps) {
  const isHindi = language === 'hi';
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Filter pipeline
  const filteredTransactions = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = t.merchant?.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchCategory = t.category_name?.toLowerCase().includes(q);
      const matchAccount = t.account_name?.toLowerCase().includes(q);
      const matchTransferTo = t.transfer_to_account_name?.toLowerCase().includes(q);
      return matchMerchant || matchNote || matchCategory || matchAccount || matchTransferTo;
    }

    return true;
  });

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteTransaction(id);
    } finally {
      setDeletingId(null);
    }
  };

  const getSourceBadge = (source: DisplayTransaction['source']) => {
    switch (source) {
      case 'whatsapp_image':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Camera className="h-2.5 w-2.5" />
            <span>{isHindi ? 'स्क्रीनशॉट' : 'Screenshot'}</span>
          </span>
        );
      case 'whatsapp_text':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Smartphone className="h-2.5 w-2.5" />
            <span>WhatsApp</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <Globe className="h-2.5 w-2.5" />
            <span>Web</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            {isHindi ? 'हाल का लेन-देन' : 'Recent Transactions'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isHindi
              ? `${transactions.length} लेन-देन दर्ज हैं`
              : `${transactions.length} transactions recorded`}
          </p>
        </div>

        {/* Quick Statement Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!simpleMode && transactions.length > 0 && (
            <>
              <button
                onClick={() => exportTransactionsToCSV(transactions)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title={isHindi ? 'एक्सेल/CSV फ़ाइल डाउनलोड करें' : 'Download Excel/CSV Statement'}
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>

              <button
                onClick={() =>
                  printTransactionStatement(transactions, {
                    startingBalanceRupees,
                    periodLabel: isHindi ? 'महीने का विवरण' : 'Monthly Statement',
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title={isHindi ? 'स्टेटमेंट प्रिंट या PDF सेव करें' : 'Print or Save Statement as PDF'}
              >
                <Printer className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                <span className="hidden sm:inline">{isHindi ? 'प्रिंट' : 'Print'}</span>
              </button>
            </>
          )}

          {simpleMode && onShowAllTransactions && transactions.length > 5 && (
            <button
              onClick={onShowAllTransactions}
              className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {isHindi ? 'सभी देखें' : 'View all'}
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isHindi ? 'जोड़ें' : 'Add'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isHindi ? 'दुकानदार, नोट या खाता खोजें…' : 'Search merchant, note, or account...'}
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

        {/* Type Filter Pills (All / Expense / Income / Transfer) */}
        <div className="grid grid-cols-4 sm:flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800 text-center">
          <button
            onClick={() => setTypeFilter('all')}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition sm:px-2.5 ${
              typeFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {isHindi ? 'सब' : 'All'}
          </button>
          <button
            onClick={() => setTypeFilter('expense')}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition sm:px-2.5 ${
              typeFilter === 'expense'
                ? 'bg-white text-rose-600 shadow-2xs dark:bg-zinc-700 dark:text-rose-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {isHindi ? 'खर्च' : 'Expense'}
          </button>
          <button
            onClick={() => setTypeFilter('income')}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition sm:px-2.5 ${
              typeFilter === 'income'
                ? 'bg-white text-emerald-600 shadow-2xs dark:bg-zinc-700 dark:text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {isHindi ? 'कमाई' : 'Income'}
          </button>
          <button
            onClick={() => setTypeFilter('transfer')}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition sm:px-2.5 ${
              typeFilter === 'transfer'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-zinc-700 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {isHindi ? 'ट्रांसफर' : 'Transfer'}
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="mt-4 space-y-2">
        {visibleTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <Receipt className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {isHindi ? 'कोई लेन-देन नहीं मिला' : 'No transactions recorded yet'}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              {searchQuery
                ? isHindi ? 'खोज हटाएं या फ़िल्टर बदलें।' : 'Try clearing your search query or switching filters.'
                : isHindi ? 'ऊपर दिए गए "+ खर्च जोड़ें" या "+ कमाई जोड़ें" से पहला लेन-देन जोड़ें।' : 'Click "+ Add Expense" or "+ Add Income" above to log your first transaction!'}
            </p>
          </div>
        ) : (
          visibleTransactions.map((tx) => {
            const isExpense = tx.type === 'expense';
            const isTransfer = tx.type === 'transfer';
            const dateStr = new Date(tx.occurred_at).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
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
                      isTransfer
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                        : isExpense
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}
                  >
                    {isTransfer ? (
                      <ArrowRightLeft className="h-4 w-4" />
                    ) : isExpense ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {isTransfer
                          ? tx.merchant || `${tx.account_name || 'Bank'} → ${tx.transfer_to_account_name || 'Cash'}`
                          : tx.merchant || tx.note || (isExpense ? 'Expense' : 'Income')}
                      </span>
                      {!simpleMode && getSourceBadge(tx.source)}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {isTransfer ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          ⇄ {tx.account_name || 'Bank'} → {tx.transfer_to_account_name || 'Cash'}
                        </span>
                      ) : (
                        <>
                          {tx.account_name && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                tx.account_name.toLowerCase().includes('cash')
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              }`}
                            >
                              {tx.account_name.toLowerCase().includes('cash') ? '💵 Cash' : '💳 Online'}
                            </span>
                          )}
                          {!simpleMode && tx.category_name && (
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: tx.category_color || '#64748B' }}
                              />
                              {categoryLabel(tx.category_name, language)}
                            </span>
                          )}
                        </>
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
                      isTransfer
                        ? 'text-blue-600 dark:text-blue-400'
                        : isExpense
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isTransfer ? '⇄ ' : isExpense ? '-' : '+'}
                    {formatINR(tx.amount_paise, { showPaise: false })}
                  </span>

                  <button
                    onClick={() => handleDelete(tx.id)}
                    disabled={deletingId === tx.id}
                    className={`rounded-lg p-2 text-zinc-400 transition hover:text-rose-600 disabled:opacity-50 ${simpleMode ? '' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
                    title={isHindi ? 'हटाएं' : 'Delete'}
                    aria-label={`${isHindi ? 'हटाएं' : 'Delete'} ${tx.merchant || tx.note || 'transaction'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {filteredTransactions.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 15)}
            className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isHindi
              ? `और लेन-देन देखें (${filteredTransactions.length - visibleCount} बाकी)`
              : `Show more (${filteredTransactions.length - visibleCount} remaining)`}
          </button>
        )}
      </div>
    </div>
  );
}
