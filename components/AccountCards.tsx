'use client';

import React, { useState } from 'react';
import {
  Landmark,
  Banknote,
  ShieldCheck,
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  X,
  Wallet,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { accountLabel, type AppLanguage } from '@/lib/i18n';

export interface DashboardAccount {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet';
  purpose: 'spending' | 'savings';
  is_default: boolean;
  opening_balance_paise: number;
  target_goal_paise?: number | null;
  current_balance_paise: number;
}

interface AccountCardsProps {
  accounts: DashboardAccount[];
  onReconcile: (accountId: string, actualRupees: number) => Promise<void>;
  onOpenTransferModal?: () => void;
  language: AppLanguage;
}

export function AccountCards({
  accounts,
  onReconcile,
  onOpenTransferModal,
  language,
}: AccountCardsProps) {
  const isHindi = language === 'hi';
  const [activeReconcileAccount, setActiveReconcileAccount] = useState<DashboardAccount | null>(null);
  const [actualRupeesInput, setActualRupeesInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReconcileModal = (account: DashboardAccount) => {
    setActiveReconcileAccount(account);
    const rupees = account.current_balance_paise / 100;
    setActualRupeesInput(rupees === 0 ? '' : rupees.toString());
    setError(null);
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReconcileAccount) return;

    const parsed = Number(actualRupeesInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(isHindi ? 'कृपया एक वैध राशि डालें' : 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onReconcile(activeReconcileAccount.id, parsed);
      setActiveReconcileAccount(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  const calculatedDifferenceRupees = activeReconcileAccount
    ? Number(actualRupeesInput || 0) - activeReconcileAccount.current_balance_paise / 100
    : 0;

  // Separate accounts into Spending vs Savings Vaults
  const spendingAccounts = accounts.filter((a) => a.purpose === 'spending');
  const savingsVaults = accounts.filter((a) => a.purpose === 'savings');

  const renderAccountCard = (acc: DashboardAccount) => {
    const isOnlineSpending = acc.type === 'bank' && acc.purpose === 'spending';
    const isCashSpending = acc.type === 'cash' && acc.purpose === 'spending';
    const isOnlineVault = acc.purpose === 'savings' && (acc.type === 'bank' || acc.name.toLowerCase().includes('online'));
    const isCashVault = acc.purpose === 'savings' && (acc.type === 'cash' || acc.name.toLowerCase().includes('cash'));

    const cardTheme = isOnlineSpending
      ? 'border-blue-100 bg-linear-to-b from-blue-50/40 to-white dark:border-blue-900/30 dark:from-blue-950/20 dark:to-zinc-900'
      : isCashSpending
      ? 'border-amber-100 bg-linear-to-b from-amber-50/40 to-white dark:border-amber-900/30 dark:from-amber-950/20 dark:to-zinc-900'
      : isOnlineVault
      ? 'border-indigo-100 bg-linear-to-b from-indigo-50/40 to-white dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-zinc-900'
      : 'border-emerald-100 bg-linear-to-b from-emerald-50/40 to-white dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-zinc-900';

    const iconTheme = isOnlineSpending
      ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
      : isCashSpending
      ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
      : isOnlineVault
      ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400';

    const titleText = isOnlineSpending
      ? isHindi ? 'बैंक / UPI (ऑनलाइन)' : 'Bank / UPI (Online)'
      : isCashSpending
      ? isHindi ? 'नकद (हाथ में)' : 'Cash (In Hand)'
      : isOnlineVault
      ? isHindi ? 'ऑनलाइन वॉल्ट (बैंक बचत)' : 'Online Vault (Bank Savings)'
      : isHindi ? 'कैश वॉल्ट (नकद बचत)' : 'Cash Vault (Cash Savings)';

    const subtitleText = isOnlineSpending
      ? isHindi ? 'GPay, PhonePe, कार्ड' : 'Daily UPI & Card spending'
      : isCashSpending
      ? isHindi ? 'बटुआ व जेब का नकद' : 'Physical cash in pocket'
      : isOnlineVault
      ? isHindi ? 'बैंक में सुरक्षित डिजिटल बचत' : 'Digital reserve locked from daily budget'
      : isHindi ? 'घर में रखी नकद बचत' : 'Physical cash reserve';

    const tagText = isOnlineSpending
      ? isHindi ? 'UPI / बैंक' : 'UPI/Online'
      : isCashSpending
      ? isHindi ? 'बटुआ/जेब' : 'Pocket Cash'
      : isOnlineVault
      ? isHindi ? 'बैंक बचत' : 'Online Saved'
      : isHindi ? 'नकद बचत' : 'Cash Saved';

    return (
      <div
        key={acc.id}
        className={`relative flex flex-col justify-between rounded-3xl border p-5 shadow-xs transition hover:shadow-md ${cardTheme}`}
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconTheme}`}>
                {isOnlineSpending ? (
                  <Landmark className="h-5 w-5" />
                ) : isCashSpending ? (
                  <Banknote className="h-5 w-5" />
                ) : isOnlineVault ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <Wallet className="h-5 w-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {titleText}
                </h4>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {subtitleText}
                </span>
              </div>
            </div>

            {acc.is_default && (
              <span className="rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                {isHindi ? 'मुख्य' : 'Default'}
              </span>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {acc.purpose === 'savings'
                ? isHindi ? 'सुरक्षित बचत' : 'Locked Savings'
                : isHindi ? 'उपलब्ध खर्च शेष' : 'Spending Balance'}
            </p>
            <p className="mt-1 text-2xl font-black text-zinc-900 dark:text-zinc-50">
              {formatINR(acc.current_balance_paise, { showPaise: false })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openReconcileModal(acc)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                isCashSpending
                  ? 'text-amber-700 hover:text-amber-800 dark:text-amber-400'
                  : isOnlineSpending
                  ? 'text-blue-700 hover:text-blue-800 dark:text-blue-400'
                  : isOnlineVault
                  ? 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-400'
                  : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>
                {isCashSpending || isCashVault
                  ? isHindi ? 'गिनती से मिलाएं' : 'Match Cash'
                  : isHindi ? 'बैलेंस सेट करें' : 'Set Balance'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTransferModal && onOpenTransferModal()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ArrowRightLeft className="h-3 w-3" />
              <span>{isHindi ? '⇄ ट्रांसफर' : '⇄ Transfer'}</span>
            </button>
          </div>

          <span className="text-[10px] font-medium text-zinc-400">
            {tagText}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Daily Spending Accounts (Online & Cash) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? '💳 दैनिक खर्च खाते (Spending Accounts)' : '💳 Daily Spending Accounts'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'ऑनलाइन (UPI) और नकद - रोज के खर्च के लिए' : 'Online (UPI) & Cash in pocket for daily expenses'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {spendingAccounts.map(renderAccountCard)}
        </div>
      </div>

      {/* 2. The Two Savings Vaults (Online Vault & Cash Vault) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🏦 {isHindi ? 'दो बचत वॉल्ट (Two Savings Vaults)' : 'Two Savings Vaults'}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {isHindi ? 'सुरक्षित पैसा' : 'Locked from daily budget'}
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'ऑनलाइन बैंक बचत और नकद बचत - दोनों अलग-अलग सुरक्षित' : 'Online bank savings and cash savings kept strictly separate'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {savingsVaults.map(renderAccountCard)}
        </div>
      </div>

      {/* Reconcile Modal */}
      {activeReconcileAccount && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4 backdrop-blur-xs">
          <div className="relative max-h-[92vh] sm:max-h-none overflow-y-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            <button
              onClick={() => setActiveReconcileAccount(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {isHindi
                    ? `${accountLabel(activeReconcileAccount.name, language)} का बैलेंस सेट करें`
                    : `Set Balance: ${activeReconcileAccount.name}`}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isHindi
                    ? 'वास्तविक राशि डालें ताकि ऐप और वास्तविक पैसे का सटीक मिलान रहे।'
                    : 'Enter the actual amount in hand or bank to sync with reality.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleReconcileSubmit} className="mt-5 space-y-4">
              <div className="rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{isHindi ? 'ऐप में दर्ज बैलेंस:' : 'Current Balance in App:'}</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    {formatINR(activeReconcileAccount.current_balance_paise)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'वास्तविक राशि (हाथ में या बैंक में)' : 'Actual amount in hand or bank (₹)'}
                </label>
                <div className="mt-1.5 flex items-center rounded-2xl border-2 border-zinc-300 bg-white px-3.5 py-2 transition-colors focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="mr-2 text-xl font-bold text-zinc-500 dark:text-zinc-400 select-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualRupeesInput}
                    onChange={(e) => setActualRupeesInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    required
                    autoFocus
                    className="w-full bg-transparent text-xl font-black text-zinc-950 placeholder:text-zinc-400 focus:outline-hidden dark:text-zinc-50"
                  />
                </div>
              </div>

              {/* Adjustment Preview */}
              {Math.abs(calculatedDifferenceRupees) > 0.01 && (
                <div
                  className={`rounded-xl p-3 text-xs ${
                    calculatedDifferenceRupees > 0
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                  }`}
                >
                  <span className="font-semibold">
                    {isHindi ? 'अंतर:' : 'Adjustment Difference:'}{' '}
                    {calculatedDifferenceRupees > 0 ? '+' : ''}
                    ₹{calculatedDifferenceRupees.toFixed(2)}
                  </span>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    {calculatedDifferenceRupees > 0
                      ? isHindi
                        ? 'ऐप में यह राशि समायोजन कमाई के रूप में दर्ज होगी।'
                        : 'A balance adjustment income record will be added.'
                      : isHindi
                      ? 'ऐप में यह राशि समायोजन खर्च के रूप में दर्ज होगी।'
                      : 'A balance adjustment expense record will be added.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>{isHindi ? 'बैलेंस अपडेट करें' : 'Confirm & Sync Balance'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
