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
  language,
}: SavingsVaultCardProps) {
  const isHindi = language === 'hi';

  // Extract savings accounts vs spending accounts
  const savingsAccounts = accounts.filter((a) => a.purpose === 'savings');
  const spendingAccounts = accounts.filter((a) => a.purpose === 'spending');
  const defaultSpendingAccount = spendingAccounts.find((a) => a.is_default) ?? spendingAccounts[0];

  const totalSavedPaise = savingsAccounts.reduce((sum, a) => sum + a.current_balance_paise, 0);

  // Modals and form states
  const [activeTransferAccount, setActiveTransferAccount] = useState<DashboardAccount | null>(null);
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [transferAmountInput, setTransferAmountInput] = useState<string>('500');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>(
    defaultSpendingAccount?.id ?? ''
  );

  const [activeGoalAccount, setActiveGoalAccount] = useState<DashboardAccount | null>(null);
  const [goalAmountInput, setGoalAmountInput] = useState<string>('');

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
      showFeedback(isHindi ? 'UPI ID सफलतापूर्वक अपडेट हो गया!' : 'Savings UPI ID updated successfully!');
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
      showFeedback(isHindi ? 'कृपया एक वैध राशि दर्ज करें' : 'Please enter a valid amount', true);
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === selectedSourceAccountId) ?? spendingAccounts[0] ?? accounts[0];
    if (!sourceAcc) {
      showFeedback(isHindi ? 'कोई खाता नहीं मिला' : 'No account found', true);
      return;
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
            ? `₹${amount} को ${activeTransferAccount.name} में सुरक्षित जमा किया गया!`
            : `₹${amount} successfully locked into ${activeTransferAccount.name}!`
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
            ? `₹${amount} को ${sourceAcc.name} में निकाला गया!`
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
      showFeedback(isHindi ? 'बचत लक्ष्य अपडेट किया गया!' : 'Savings target updated!');
      setActiveGoalAccount(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update goal', true);
    } finally {
      setLoading(false);
    }
  };

  // Handle Create New Savings Bucket
  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) {
      showFeedback(isHindi ? 'कृपया लक्ष्य का नाम दें' : 'Please provide a name for this goal', true);
      return;
    }

    const parsedTarget = newGoalTarget.trim() === '' ? null : Number(newGoalTarget);
    setLoading(true);
    try {
      await onCreateSavingsAccount(newGoalName.trim(), parsedTarget);
      showFeedback(isHindi ? 'नया बचत खाता तैयार हो गया!' : 'New savings goal created!');
      setIsCreatingNewGoal(false);
      setNewGoalName('');
      setNewGoalTarget('');
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to create savings goal', true);
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
      showFeedback(isHindi ? 'कृपया एक वैध राशि चुनें' : 'Please enter a valid amount to save', true);
      return;
    }

    const targetSavings =
      savingsAccounts.find((a) => a.id === selectedSavingsAccountId) ?? savingsAccounts[0];

    if (!targetSavings) {
      showFeedback(isHindi ? 'कोई बचत खाता नहीं मिला' : 'No savings account available', true);
      return;
    }

    const upiUrl = buildUpiPayUrl({
      upiId: savingsUpiId,
      payeeName: targetSavings.name,
      amountRupees: effectiveAmount,
      transactionNote: `Track Expenser Savings - ${targetSavings.name}`,
    });

    // Launch UPI intent
    window.location.href = upiUrl;

    // Open confirmation dialog so user can log the transfer once done
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
          ? `₹${amountRupees} का UPI ट्रांसफर ${savingsAccount.name} में दर्ज कर दिया गया!`
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
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-zinc-900 to-zinc-950 p-6 shadow-xl backdrop-blur-md dark:border-emerald-500/20">
      {/* Decorative Aura */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 shadow-md">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-zinc-100">
                {isHindi ? 'सुरक्षित बचत तिजोरी' : 'Savings Vault'}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                {isHindi ? 'दैनिक बजट से सुरक्षित' : 'Safe-to-Spend Protected'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              {isHindi
                ? 'यह राशि आपके दैनिक खर्च (Safe-to-Spend) से अलग और पूरी तरह सुरक्षित है।'
                : 'Ring-fenced funds excluded from daily spending limit.'}
            </p>
          </div>
        </div>

        {/* Total Locked Savings */}
        <div className="flex flex-col items-start rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 sm:items-end">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {isHindi ? 'कुल सुरक्षित बचत' : 'Total Protected Savings'}
          </span>
          <span className="text-2xl font-black tracking-tight text-emerald-400 sm:text-3xl">
            {formatINR(totalSavedPaise, { showPaise: false })}
          </span>
        </div>
      </div>

      {/* Toast Feedback Messages */}
      {successMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-950/60 p-3 text-xs font-semibold text-rose-300 border border-rose-500/30">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* UPI Quick Save Section */}
      <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-zinc-200">
              {isHindi ? 'एक क्लिक में UPI से बचत करें' : 'Save via UPI Intent'}
            </h4>
          </div>

          {/* UPI Address Config */}
          <div className="flex items-center gap-2 text-xs">
            {savingsUpiId ? (
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">{isHindi ? 'खाता VPA:' : 'VPA:'}</span>
                <span className="font-mono font-medium text-emerald-400">{savingsUpiId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUpiInput(savingsUpiId);
                    setIsEditingUpi(true);
                  }}
                  className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  title="Edit UPI ID"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingUpi(true)}
                className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
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
              placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-hidden"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'सुरक्षित करें' : 'Save VPA'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingUpi(false)}
                className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700"
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
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                + ₹{amt}
              </button>
            );
          })}

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-semibold text-zinc-500">
              ₹
            </span>
            <input
              type="number"
              placeholder={isHindi ? 'अन्य राशि' : 'Custom'}
              value={customSaveAmount}
              onChange={(e) => setCustomSaveAmount(e.target.value)}
              className="w-24 rounded-xl border border-zinc-700 bg-zinc-800 py-1.5 pl-6 pr-2.5 text-xs font-semibold text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-hidden"
              min="1"
            />
          </div>

          {/* Trigger UPI Pay Button */}
          <button
            type="button"
            onClick={handleTriggerUpiPay}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md transition hover:from-emerald-400 hover:to-teal-400"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {isHindi
                ? `UPI से ₹${customSaveAmount || quickSaveAmount} सुरक्षित भेजें`
                : `Pay ₹${customSaveAmount || quickSaveAmount} via GPay/PhonePe`}
            </span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Savings Goals & Buckets Grid */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {isHindi ? 'बचत लक्ष्य और तिजोरियां' : 'Savings Goals & Vaults'}
          </h4>
          <button
            type="button"
            onClick={() => setIsCreatingNewGoal(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isHindi ? '+ नया बचत लक्ष्य जोड़ें' : '+ New Savings Goal'}</span>
          </button>
        </div>

        {/* New Goal Modal/Card */}
        {isCreatingNewGoal && (
          <form
            onSubmit={handleCreateBucket}
            className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-200">
                {isHindi ? 'नया बचत लक्ष्य बनाएं' : 'Create New Savings Goal'}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNewGoal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-zinc-400">
                  {isHindi ? 'लक्ष्य का नाम (उदा. इमरजेंसी फंड, ट्रिप)' : 'Goal Name (e.g. Emergency, Trip)'}
                </label>
                <input
                  type="text"
                  required
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="e.g. Diwali Vacation"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-400">
                  {isHindi ? 'लक्ष्य राशि ₹ (वैकल्पिक)' : 'Target Amount ₹ (Optional)'}
                </label>
                <input
                  type="number"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNewGoal(false)}
                className="rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                {loading ? '...' : isHindi ? 'बनाएं' : 'Create Goal'}
              </button>
            </div>
          </form>
        )}

        {/* Goals List */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {savingsAccounts.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isHindi
                ? 'कोई बचत खाता नहीं है। ऊपर दिए गए बटन से नया बचत लक्ष्य बनाएं।'
                : 'No savings accounts yet. Click "+ New Savings Goal" above to start ring-fencing your savings.'}
            </div>
          ) : (
            savingsAccounts.map((acc) => {
              const currentRupees = acc.current_balance_paise / 100;
              const targetRupees = acc.target_goal_paise ? acc.target_goal_paise / 100 : null;
              const progressPercent = targetRupees && targetRupees > 0
                ? Math.min(100, Math.round((currentRupees / targetRupees) * 100))
                : null;

              return (
                <div
                  key={acc.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-800/90 bg-zinc-900/90 p-4 transition hover:border-emerald-500/40"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-zinc-100">{acc.name}</h5>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            {acc.type}
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
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                        title="Edit Target Goal"
                      >
                        <Target className="h-3 w-3 text-emerald-400" />
                        <span>
                          {targetRupees ? `₹${targetRupees.toLocaleString('en-IN')}` : isHindi ? '+ लक्ष्य' : '+ Set Goal'}
                        </span>
                      </button>
                    </div>

                    {/* Balance */}
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-xl font-black tracking-tight text-zinc-100">
                        {formatINR(acc.current_balance_paise, { showPaise: false })}
                      </span>
                      {progressPercent !== null && (
                        <span className="text-xs font-bold text-emerald-400">
                          {progressPercent}%
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {progressPercent !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions: Deposit / Withdraw Modal Trigger */}
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTransferAccount(acc);
                        setTransferMode('deposit');
                        setTransferAmountInput('500');
                        const isCashVault = acc.type === 'cash' || acc.name.toLowerCase().includes('cash');
                        const defaultSrc = isCashVault
                          ? accounts.find((a) => a.type === 'cash')
                          : accounts.find((a) => a.type === 'bank' || a.is_default);
                        setSelectedSourceAccountId(defaultSrc?.id ?? accounts[0]?.id ?? '');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 transition hover:text-emerald-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isHindi ? 'पैसे जोड़ें (Deposit)' : 'Deposit Money'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTransferAccount(acc);
                        setTransferMode('withdraw');
                        setTransferAmountInput('500');
                        const isCashVault = acc.type === 'cash' || acc.name.toLowerCase().includes('cash');
                        const defaultDest = isCashVault
                          ? accounts.find((a) => a.type === 'cash')
                          : accounts.find((a) => a.type === 'bank' || a.is_default);
                        setSelectedSourceAccountId(defaultDest?.id ?? accounts[0]?.id ?? '');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      <span>{isHindi ? 'निकालें (Withdraw)' : 'Withdraw'}</span>
                    </button>
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
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-emerald-400" />
                <h4 className="text-base font-bold text-zinc-100">
                  {transferMode === 'deposit'
                    ? isHindi
                      ? `${activeTransferAccount.name} में सुरक्षित जमा`
                      : `Deposit into ${activeTransferAccount.name}`
                    : isHindi
                    ? `${activeTransferAccount.name} से निकालें`
                    : `Withdraw from ${activeTransferAccount.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveTransferAccount(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400">
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
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                >
                  {accounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.purpose === 'savings' ? (isHindi ? 'तिजोरी' : 'Vault') : (isHindi ? 'खर्च' : 'Spending')}) - {formatINR(s.current_balance_paise, { showPaise: false })}
                    </option>
                  ))}
                </select>
                {selectedSourceAccountId === activeTransferAccount.id && (
                  <p className="mt-1 text-[11px] font-medium text-emerald-400">
                    {isHindi
                      ? '✨ समान खाते में ट्रांसफर (सीधा बैलेंस जोड़ना / टॉप-अप)'
                      : '✨ Same account transfer (direct deposit / top-up)'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400">
                  {isHindi ? 'राशि (₹):' : 'Amount (₹):'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-base font-bold text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <p className="text-[11px] text-zinc-400">
                {transferMode === 'deposit'
                  ? isHindi
                    ? '✨ यह राशि आपके दैनिक Safe-to-Spend को प्रभावित नहीं करेगी, यह आपकी बचत में सुरक्षित लॉक हो जाएगी।'
                    : '✨ This money is ring-fenced and locked into your savings vault, protected from daily impulsive spending.'
                  : isHindi
                  ? '✨ यह राशि वापस आपके खर्च खाते में आ जाएगी।'
                  : '✨ This money will return to your liquid spending balance.'}
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTransferAccount(null)}
                  className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading
                    ? '...'
                    : transferMode === 'deposit'
                    ? isHindi ? 'सुरक्षित जमा करें' : 'Lock Deposit'
                    : isHindi ? 'निकालें' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Target Goal Modal */}
      {activeGoalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-zinc-100">
                  {isHindi ? `${activeGoalAccount.name} का लक्ष्य बदलें` : `Set Target for ${activeGoalAccount.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveGoalAccount(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400">
                  {isHindi ? 'लक्ष्य राशि ₹ (हटाने के लिए खाली छोड़ें):' : 'Target Amount ₹ (leave blank to remove):'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={goalAmountInput}
                  onChange={(e) => setGoalAmountInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-bold text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveGoalAccount(null)}
                  className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? '...' : isHindi ? 'सहेजें' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-UPI Confirmation Dialog */}
      {upiConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto mb-3">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h4 className="text-center text-base font-bold text-zinc-100">
              {isHindi ? 'क्या आपने UPI भुगतान पूरा कर लिया?' : 'Did you complete the UPI payment?'}
            </h4>
            <p className="mt-2 text-center text-xs text-zinc-400">
              {isHindi
                ? `यदि आपने अपने UPI ऐप में ₹${upiConfirmModal.amountRupees} का भुगतान कर दिया है, तो नीचे क्लिक करके इसे अपने ${upiConfirmModal.savingsAccount.name} में ट्रांसफर के रूप में दर्ज करें।`
                : `If you completed the ₹${upiConfirmModal.amountRupees} payment in GPay/PhonePe, click below to record the transfer into your ${upiConfirmModal.savingsAccount.name}.`}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setUpiConfirmModal(null)}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
              >
                {isHindi ? 'बाद में' : 'Not yet / Dismiss'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmUpiTransfer}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-bold text-zinc-950 shadow-md hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'हाँ, बचत में दर्ज करें' : 'Record in Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
