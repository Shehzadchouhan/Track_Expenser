'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  WalletCards,
  Target,
  ArrowRightLeft,
  Edit3,
  Plus,
  Check,
  X,
  ExternalLink,
  Lock,
  Sparkles,
  Smartphone,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { buildUpiPayUrl, isValidUpiId } from '@/lib/upi';
import type { AppLanguage } from '@/lib/i18n';
import type { DashboardAccount } from './AccountCards';

interface SavingsVaultCardProps {
  accounts: DashboardAccount[];
  savingsUpiId: string | null;
  onUpdateSavingsUpi: (upiId: string) => Promise<void>;
  onTransfer: (fromAccountId: string, toAccountId: string, amountRupees: number, note?: string) => Promise<void>;
  onUpdateGoal: (accountId: string, targetGoalRupees: number | null) => Promise<void>;
  onCreateSavingsAccount: (name: string, targetGoalRupees: number | null) => Promise<void>;
  onReconcile?: (accountId: string, actualRupees: number) => Promise<void>;
  language: AppLanguage;
}

const QUICK_SAVE_AMOUNTS = [100, 500, 1000, 2000];

export function SavingsVaultCard({
  accounts,
  savingsUpiId,
  onUpdateSavingsUpi,
  onTransfer,
  onUpdateGoal,
  onCreateSavingsAccount,
  onReconcile,
  language,
}: SavingsVaultCardProps) {
  const isHindi = language === 'hi';

  // Extract savings accounts vs spending accounts
  const savingsAccounts = accounts.filter((a) => a.purpose === 'savings');
  const spendingAccounts = accounts.filter((a) => a.purpose === 'spending');
  const defaultSpendingAccount = spendingAccounts.find((a) => a.is_default) ?? spendingAccounts[0];

  const totalSavedPaise = savingsAccounts.reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);
  const onlineSavingsPaise = savingsAccounts
    .filter((a) => a.type === 'bank' || a.name.toLowerCase().includes('online'))
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);
  const cashSavingsPaise = savingsAccounts
    .filter((a) => a.type === 'cash' || a.name.toLowerCase().includes('cash'))
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  // Modals and form states
  const [activeTransferAccount, setActiveTransferAccount] = useState<DashboardAccount | null>(null);
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [transferAmountInput, setTransferAmountInput] = useState<string>('500');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>(
    defaultSpendingAccount?.id ?? ''
  );

  const [activeGoalAccount, setActiveGoalAccount] = useState<DashboardAccount | null>(null);
  const [goalAmountInput, setGoalAmountInput] = useState<string>('');

  const [activeReconcileAccount, setActiveReconcileAccount] = useState<DashboardAccount | null>(null);
  const [reconcileRupeesInput, setReconcileRupeesInput] = useState<string>('');

  const [isEditingUpi, setIsEditingUpi] = useState<boolean>(false);
  const [upiInput, setUpiInput] = useState<string>(savingsUpiId ?? '');

  const [isCreatingNewGoal, setIsCreatingNewGoal] = useState<boolean>(false);
  const [newGoalName, setNewGoalName] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');

  const [quickSaveAmount, setQuickSaveAmount] = useState<number>(500);
  const [customSaveAmount, setCustomSaveAmount] = useState<string>('');
  const [selectedSavingsAccountId, setSelectedSavingsAccountId] = useState<string>(
    savingsAccounts[0]?.id ?? ''
  );
  const [upiConfirmModal, setUpiConfirmModal] = useState<{
    amountRupees: number;
    savingsAccount: DashboardAccount;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const parsedTransferAmount = Number(transferAmountInput);
  const transferAmountPaise = Number.isFinite(parsedTransferAmount) && parsedTransferAmount > 0 ? Math.round(parsedTransferAmount * 100) : 0;
  const activeSourceAcc = accounts.find((a) => a.id === selectedSourceAccountId) ?? spendingAccounts[0] ?? accounts[0];

  const isVaultInsufficient = !!(
    activeTransferAccount &&
    transferAmountPaise > 0 &&
    (transferMode === 'deposit'
      ? (selectedSourceAccountId !== activeTransferAccount.id && activeSourceAcc && activeSourceAcc.current_balance_paise < transferAmountPaise)
      : (activeTransferAccount.current_balance_paise < transferAmountPaise))
  );

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Handle saving UPI ID
  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = upiInput.trim();
    if (clean !== '' && !isValidUpiId(clean)) {
      showFeedback(
        isHindi
          ? 'अमान्य UPI ID! कृपया उदाहरण स्वरूप user@okhdfcbank या 9876543210@paytm दर्ज करें'
          : 'Invalid UPI ID format! (e.g. user@okhdfcbank or 9876543210@paytm)',
        true
      );
      return;
    }

    setLoading(true);
    try {
      await onUpdateSavingsUpi(clean);
      setIsEditingUpi(false);
      showFeedback(isHindi ? 'UPI ID सुरक्षित हो गया!' : 'Savings UPI ID updated!');
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update UPI ID', true);
    } finally {
      setLoading(false);
    }
  };

  // Handle in-app transfer (Deposit / Withdraw)
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransferAccount) return;

    const amount = Number(transferAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      showFeedback(isHindi ? 'कृपया वैध राशि दर्ज करें' : 'Please enter a valid amount', true);
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === selectedSourceAccountId) ?? spendingAccounts[0] ?? accounts[0];
    if (!sourceAcc) {
      showFeedback(isHindi ? 'खाता नहीं मिला' : 'No account found', true);
      return;
    }

    const amountPaise = Math.round(amount * 100);

    // Prevent negative money storage
    if (transferMode === 'deposit') {
      if (sourceAcc.id !== activeTransferAccount.id && sourceAcc.current_balance_paise < amountPaise) {
        showFeedback(
          isHindi
            ? `${sourceAcc.name} में अपर्याप्त बैलेंस! उपलब्ध: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`
            : `Insufficient balance in ${sourceAcc.name}! Available: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`,
          true
        );
        return;
      }
    } else {
      if (activeTransferAccount.current_balance_paise < amountPaise) {
        showFeedback(
          isHindi
            ? `${activeTransferAccount.name} में अपर्याप्त बचत! उपलब्ध: ₹${(Math.max(0, activeTransferAccount.current_balance_paise) / 100).toFixed(2)}`
            : `Insufficient savings in ${activeTransferAccount.name}! Available: ₹${(Math.max(0, activeTransferAccount.current_balance_paise) / 100).toFixed(2)}`,
          true
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (transferMode === 'deposit') {
        await onTransfer(
          sourceAcc.id,
          activeTransferAccount.id,
          amount,
          `Deposit to ${activeTransferAccount.name}`
        );
        showFeedback(
          isHindi
            ? `₹${amount} ${activeTransferAccount.name} में जमा किए गए!`
            : `₹${amount} deposited into ${activeTransferAccount.name}!`
        );
      } else {
        await onTransfer(
          activeTransferAccount.id,
          sourceAcc.id,
          amount,
          `Withdrawal from ${activeTransferAccount.name}`
        );
        showFeedback(
          isHindi
            ? `₹${amount} ${sourceAcc.name} में निकाले गए!`
            : `₹${amount} withdrawn to ${sourceAcc.name}!`
        );
      }
      setActiveTransferAccount(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Transfer failed', true);
    } finally {
      setLoading(false);
    }
  };

  // Handle Goal Target update
  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoalAccount) return;

    const parsedTarget = goalAmountInput.trim() === '' ? null : Number(goalAmountInput);
    if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0)) {
      showFeedback(isHindi ? 'अमान्य लक्ष्य राशि' : 'Invalid target amount', true);
      return;
    }

    setLoading(true);
    try {
      await onUpdateGoal(activeGoalAccount.id, parsedTarget);
      showFeedback(isHindi ? 'लक्ष्य अपडेट हुआ!' : 'Savings target updated!');
      setActiveGoalAccount(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update goal', true);
    } finally {
      setLoading(false);
    }
  };

  // Handle Reconcile
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReconcileAccount || !onReconcile) return;

    const parsed = Number(reconcileRupeesInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showFeedback(isHindi ? 'कृपया वैध राशि दर्ज करें' : 'Please enter a valid amount', true);
      return;
    }

    setLoading(true);
    try {
      await onReconcile(activeReconcileAccount.id, parsed);
      showFeedback(isHindi ? 'बैलेंस सेट हो गया!' : 'Balance set successfully!');
      setActiveReconcileAccount(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update balance', true);
    } finally {
      setLoading(false);
    }
  };

  // Handle Create New Savings Bucket
  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) {
      showFeedback(isHindi ? 'कृपया लक्ष्य का नाम दें' : 'Please provide a name', true);
      return;
    }

    const parsedTarget = newGoalTarget.trim() === '' ? null : Number(newGoalTarget);
    setLoading(true);
    try {
      await onCreateSavingsAccount(newGoalName.trim(), parsedTarget);
      showFeedback(isHindi ? 'नया बचत खाता बना!' : 'New savings goal created!');
      setIsCreatingNewGoal(false);
      setNewGoalName('');
      setNewGoalTarget('');
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to create goal', true);
    } finally {
      setLoading(false);
    }
  };

  // Trigger UPI Payment
  const handleTriggerUpiPay = () => {
    if (!savingsUpiId) {
      setIsEditingUpi(true);
      return;
    }

    const effectiveAmount = customSaveAmount ? Number(customSaveAmount) : quickSaveAmount;
    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      showFeedback(isHindi ? 'कृपया वैध राशि चुनें' : 'Please enter a valid amount to save', true);
      return;
    }

    const targetSavings =
      savingsAccounts.find((a) => a.id === selectedSavingsAccountId) ?? savingsAccounts[0];

    if (!targetSavings) {
      showFeedback(isHindi ? 'कोई बचत खाता नहीं मिला' : 'No savings vault available', true);
      return;
    }

    const upiUrl = buildUpiPayUrl({
      upiId: savingsUpiId,
      payeeName: targetSavings.name,
      amountRupees: effectiveAmount,
      transactionNote: `Track Expenser Savings - ${targetSavings.name}`,
    });

    window.location.href = upiUrl;

    setUpiConfirmModal({
      amountRupees: effectiveAmount,
      savingsAccount: targetSavings,
    });
  };

  const handleConfirmUpiTransfer = async () => {
    if (!upiConfirmModal) return;
    const { amountRupees, savingsAccount } = upiConfirmModal;
    const sourceAcc = defaultSpendingAccount;

    if (!sourceAcc) {
      setUpiConfirmModal(null);
      return;
    }

    if (sourceAcc.current_balance_paise < Math.round(amountRupees * 100)) {
      showFeedback(
        isHindi
          ? `${sourceAcc.name} में अपर्याप्त बैलेंस है! उपलब्ध: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`
          : `Insufficient balance in ${sourceAcc.name}! Available: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`,
        true
      );
      setUpiConfirmModal(null);
      return;
    }

    setLoading(true);
    try {
      await onTransfer(
        sourceAcc.id,
        savingsAccount.id,
        amountRupees,
        `UPI Savings Deposit to ${savingsAccount.name}`
      );
      showFeedback(
        isHindi
          ? `₹${amountRupees} का UPI ट्रांसफर ${savingsAccount.name} में दर्ज हुआ!`
          : `₹${amountRupees} UPI deposit logged into ${savingsAccount.name}!`
      );
      setUpiConfirmModal(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Could not log UPI transfer', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      {/* Subtle Background Glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* High-Contrast Top Header Banner */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-400">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                {isHindi ? 'बचत तिजोरी' : 'Savings Vaults'}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Lock className="h-3 w-3" />
                {isHindi ? 'सुरक्षित बचत' : 'Locked Savings'}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {isHindi
                ? 'दैनिक खर्च से अलग रखी गई आपकी सुरक्षित ऑनलाइन और नकद बचत।'
                : 'Money safely ring-fenced from daily spending.'}
            </p>
          </div>
        </div>

        {/* Total Locked Savings Display */}
        <div className="flex flex-col items-start rounded-2xl border border-zinc-200 bg-zinc-50/80 px-5 py-3 sm:items-end dark:border-zinc-800 dark:bg-zinc-800/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {isHindi ? 'कुल सुरक्षित बचत' : 'Total Saved'}
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatINR(totalSavedPaise, { showPaise: false })}
          </span>
        </div>
      </div>

      {/* Online & Cash Vault Pill Breakdowns */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
          🏦 {isHindi ? 'ऑनलाइन वॉल्ट:' : 'Online Vault:'} <strong>{formatINR(onlineSavingsPaise, { showPaise: false })}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
          💵 {isHindi ? 'कैश वॉल्ट:' : 'Cash Vault:'} <strong>{formatINR(cashSavingsPaise, { showPaise: false })}</strong>
        </span>
      </div>

      {/* Toast Feedback Messages */}
      {successMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/30">
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/30">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* UPI Quick Save Section */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'UPI से बचत करें' : 'Quick Save via UPI'}
            </h4>
          </div>

          {/* UPI Address Config */}
          <div className="flex items-center gap-2 text-xs">
            {savingsUpiId ? (
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">{isHindi ? 'UPI ID:' : 'UPI ID:'}</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{savingsUpiId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUpiInput(savingsUpiId);
                    setIsEditingUpi(true);
                  }}
                  className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  title="Edit UPI ID"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingUpi(true)}
                className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" />
                {isHindi ? '+ अपना UPI ID जोड़ें' : '+ Link Savings UPI ID'}
              </button>
            )}
          </div>
        </div>

        {/* Inline UPI ID Edit Form */}
        {isEditingUpi && (
          <form onSubmit={handleSaveUpi} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={upiInput}
              onChange={(e) => setUpiInput(e.target.value)}
              placeholder="e.g. yourname@okhdfcbank"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'सुरक्षित करें' : 'Save UPI ID'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingUpi(false)}
                className="rounded-xl bg-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Amount Chips & Pay Action */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {QUICK_SAVE_AMOUNTS.map((amt) => {
            const isSelected = quickSaveAmount === amt && !customSaveAmount;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setQuickSaveAmount(amt);
                  setCustomSaveAmount('');
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                + ₹{amt}
              </button>
            );
          })}

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">
              ₹
            </span>
            <input
              type="number"
              placeholder={isHindi ? 'अन्य राशि' : 'Custom'}
              value={customSaveAmount}
              onChange={(e) => setCustomSaveAmount(e.target.value)}
              className="w-24 rounded-xl border border-zinc-300 bg-white py-1.5 pl-6 pr-2.5 text-xs font-semibold text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              min="1"
            />
          </div>

          {/* Trigger UPI Pay Button */}
          <button
            type="button"
            onClick={handleTriggerUpiPay}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {isHindi
                ? `UPI से ₹${customSaveAmount || quickSaveAmount} भेजें`
                : `Save ₹${customSaveAmount || quickSaveAmount} via UPI`}
            </span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Savings Vaults Grid */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {isHindi ? 'आपकी तिजोरियां' : 'Your Vaults'}
          </h4>
          <button
            type="button"
            onClick={() => setIsCreatingNewGoal(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isHindi ? '+ नया बचत लक्ष्य' : '+ New Goal'}</span>
          </button>
        </div>

        {/* New Goal Modal/Card */}
        {isCreatingNewGoal && (
          <form
            onSubmit={handleCreateBucket}
            className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-xs dark:border-zinc-700 dark:bg-zinc-800/80"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {isHindi ? 'नया बचत लक्ष्य' : 'Create New Goal'}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNewGoal(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  {isHindi ? 'नाम (उदा. इमरजेंसी, ट्रिप)' : 'Goal Name (e.g. Emergency, Trip)'}
                </label>
                <input
                  type="text"
                  required
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="e.g. Vacation"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  {isHindi ? 'लक्ष्य राशि ₹ (वैकल्पिक)' : 'Target Amount ₹ (Optional)'}
                </label>
                <input
                  type="number"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNewGoal(false)}
                className="rounded-xl bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                {loading ? '...' : isHindi ? 'बनाएं' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {/* Goals / Vaults List */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {savingsAccounts.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {isHindi ? 'कोई बचत खाता नहीं है।' : 'No savings vaults yet.'}
            </div>
          ) : (
            savingsAccounts.map((acc) => {
              const currentRupees = Math.max(0, acc.current_balance_paise) / 100;
              const targetRupees = acc.target_goal_paise ? acc.target_goal_paise / 100 : null;
              const progressPercent = targetRupees && targetRupees > 0
                ? Math.min(100, Math.round((currentRupees / targetRupees) * 100))
                : null;
              const isCashVault = acc.type === 'cash' || acc.name.toLowerCase().includes('cash');

              return (
                <div
                  key={acc.id}
                  className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition ${
                    isCashVault
                      ? 'border-emerald-100 bg-linear-to-b from-emerald-50/40 to-white dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-zinc-900'
                      : 'border-indigo-100 bg-linear-to-b from-indigo-50/40 to-white dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-zinc-900'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                            isCashVault
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
                          }`}
                        >
                          {isCashVault ? <Wallet className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{acc.name}</h5>
                          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            {isCashVault ? (isHindi ? 'नकद बचत' : 'Cash Reserve') : (isHindi ? 'डिजिटल बैंक बचत' : 'Bank Reserve')}
                          </span>
                        </div>
                      </div>

                      {/* Edit Target Goal Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGoalAccount(acc);
                          setGoalAmountInput(targetRupees ? targetRupees.toString() : '');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/80 px-2 py-1 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        title="Set Goal"
                      >
                        <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {targetRupees ? `₹${targetRupees.toLocaleString('en-IN')}` : isHindi ? '+ लक्ष्य' : '+ Goal'}
                        </span>
                      </button>
                    </div>

                    {/* Balance */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                        {formatINR(Math.max(0, acc.current_balance_paise), { showPaise: false })}
                      </span>
                      {progressPercent !== null && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {progressPercent}%
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {progressPercent !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions: Deposit / Withdraw / Set Balance */}
                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTransferAccount(acc);
                          setTransferMode('deposit');
                          setTransferAmountInput('500');
                          const defaultSrc = isCashVault
                            ? accounts.find((a) => a.purpose === 'spending' && (a.type === 'cash' || a.name.toLowerCase().includes('cash'))) || accounts.find((a) => a.purpose === 'spending')
                            : accounts.find((a) => a.purpose === 'spending' && (a.type === 'bank' || a.is_default)) || accounts.find((a) => a.purpose === 'spending');
                          setSelectedSourceAccountId(defaultSrc?.id ?? accounts[0]?.id ?? '');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isHindi ? 'जमा' : 'Deposit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTransferAccount(acc);
                          setTransferMode('withdraw');
                          setTransferAmountInput('500');
                          const defaultDest = isCashVault
                            ? accounts.find((a) => a.purpose === 'spending' && (a.type === 'cash' || a.name.toLowerCase().includes('cash'))) || accounts.find((a) => a.purpose === 'spending')
                            : accounts.find((a) => a.purpose === 'spending' && (a.type === 'bank' || a.is_default)) || accounts.find((a) => a.purpose === 'spending');
                          setSelectedSourceAccountId(defaultDest?.id ?? accounts[0]?.id ?? '');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span>{isHindi ? 'निकालें' : 'Withdraw'}</span>
                      </button>
                    </div>

                    {onReconcile && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReconcileAccount(acc);
                          const currentRupees = acc.current_balance_paise / 100;
                          setReconcileRupeesInput(currentRupees === 0 ? '' : currentRupees.toString());
                        }}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        {isHindi ? 'बैलेंस सेट करें' : 'Set Balance'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Deposit / Withdraw Modal */}
      {activeTransferAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {transferMode === 'deposit'
                    ? isHindi
                      ? `${activeTransferAccount.name} में जमा करें`
                      : `Deposit into ${activeTransferAccount.name}`
                    : isHindi
                    ? `${activeTransferAccount.name} से निकालें`
                    : `Withdraw from ${activeTransferAccount.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveTransferAccount(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {transferMode === 'deposit'
                    ? isHindi
                      ? 'किस खाते से निकालना है:'
                      : 'Transfer From Account:'
                    : isHindi
                    ? 'किस खाते में भेजना है:'
                    : 'Transfer To Account:'}
                </label>
                <select
                  value={selectedSourceAccountId}
                  onChange={(e) => setSelectedSourceAccountId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.purpose === 'savings' ? (isHindi ? 'तिजोरी' : 'Vault') : (isHindi ? 'खर्च' : 'Spending')}) - {formatINR(Math.max(0, s.current_balance_paise), { showPaise: false })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {isHindi ? 'राशि (₹):' : 'Amount (₹):'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(e.target.value)}
                  className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-base font-bold text-zinc-900 focus:outline-hidden dark:text-zinc-100 ${
                    isVaultInsufficient
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 focus:border-rose-500'
                      : 'border-zinc-300 bg-white focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
                />
              </div>

              {isVaultInsufficient && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <p className="font-bold">
                      {isHindi ? 'अपर्याप्त बैलेंस' : 'Insufficient Balance'}
                    </p>
                    <p className="mt-0.5 text-[11px]">
                      {isHindi
                        ? `उपलब्ध: ₹${(Math.max(0, transferMode === 'deposit' ? (activeSourceAcc?.current_balance_paise ?? 0) : activeTransferAccount.current_balance_paise) / 100).toFixed(2)}`
                        : `Available: ₹${(Math.max(0, transferMode === 'deposit' ? (activeSourceAcc?.current_balance_paise ?? 0) : activeTransferAccount.current_balance_paise) / 100).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTransferAccount(null)}
                  className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading || isVaultInsufficient}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition disabled:opacity-50 ${
                    isVaultInsufficient ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {loading
                    ? '...'
                    : isVaultInsufficient
                    ? isHindi ? 'अपर्याप्त बैलेंस' : 'Insufficient Balance'
                    : transferMode === 'deposit'
                    ? isHindi ? 'जमा करें' : 'Deposit'
                    : isHindi ? 'निकालें' : 'Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {activeReconcileAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? `${activeReconcileAccount.name} का बैलेंस सेट करें` : `Set Balance: ${activeReconcileAccount.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveReconcileAccount(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {isHindi ? 'वास्तविक बैलेंस (₹):' : 'Actual Balance (₹):'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={reconcileRupeesInput}
                  onChange={(e) => setReconcileRupeesInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReconcileAccount(null)}
                  className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? '...' : isHindi ? 'सहेजें' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Target Goal Modal */}
      {activeGoalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? `${activeGoalAccount.name} का लक्ष्य बदलें` : `Set Target for ${activeGoalAccount.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveGoalAccount(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {isHindi ? 'लक्ष्य राशि ₹ (हटाने के लिए खाली छोड़ें):' : 'Target Amount ₹ (leave blank to remove):'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={goalAmountInput}
                  onChange={(e) => setGoalAmountInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveGoalAccount(null)}
                  className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? '...' : isHindi ? 'सहेजें' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-UPI Confirmation Dialog */}
      {upiConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto mb-3 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h4 className="text-center text-base font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'क्या आपने UPI भुगतान पूरा कर लिया?' : 'Did you complete the UPI payment?'}
            </h4>
            <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
              {isHindi
                ? `यदि आपने ₹${upiConfirmModal.amountRupees} का भुगतान कर दिया है, तो इसे ${upiConfirmModal.savingsAccount.name} में दर्ज करें।`
                : `If you completed ₹${upiConfirmModal.amountRupees} in UPI, record it in ${upiConfirmModal.savingsAccount.name}.`}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setUpiConfirmModal(null)}
                className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {isHindi ? 'बाद में' : 'Dismiss'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmUpiTransfer}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'हाँ, दर्ज करें' : 'Record in Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
