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
  Trash2,
  Info,
  Globe,
  Coins,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { buildUpiPayUrl, isValidUpiId } from '@/lib/upi';
import type { AppLanguage } from '@/lib/i18n';
import type { DashboardAccount } from './AccountCards';

export interface SavingsVaultCardProps {
  accounts: DashboardAccount[];
  savingsUpiId: string | null;
  onUpdateSavingsUpi: (upiId: string) => Promise<void>;
  onTransfer: (fromAccountId: string, toAccountId: string, amountRupees: number, note?: string) => Promise<void>;
  onUpdateGoal: (accountId: string, targetGoalRupees: number | null) => Promise<void>;
  onCreateSavingsAccount: (
    name: string,
    type: 'bank' | 'cash',
    targetGoalRupees: number | null,
    initialDepositRupees?: number,
    depositFromAccountId?: string
  ) => Promise<void>;
  onUpdateAccount?: (
    accountId: string,
    updates: { name?: string; type?: 'bank' | 'cash'; targetGoalRupees?: number | null }
  ) => Promise<void>;
  onDeleteAccount?: (accountId: string, transferToAccountId?: string) => Promise<void>;
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
  onUpdateAccount,
  onDeleteAccount,
  onReconcile,
  language,
}: SavingsVaultCardProps) {
  const isHindi = language === 'hi';

  // Extract savings accounts vs spending accounts
  const savingsAccounts = accounts.filter((a) => a.purpose === 'savings');
  const spendingAccounts = accounts.filter((a) => a.purpose === 'spending');
  const onlineSpendingAccount = spendingAccounts.find((a) => a.type === 'bank' || a.is_default) ?? spendingAccounts[0];
  const cashSpendingAccount = spendingAccounts.find((a) => a.type === 'cash') ?? spendingAccounts[0];
  const defaultSpendingAccount = onlineSpendingAccount ?? spendingAccounts[0];

  const totalSavedPaise = savingsAccounts.reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);
  
  // Categorized based on user-chosen type ('bank' for Online, 'cash' for Offline/Cash)
  const onlineSavingsVaults = savingsAccounts.filter(
    (a) => a.type === 'bank' || (!a.type && a.name.toLowerCase().includes('online'))
  );
  const cashSavingsVaults = savingsAccounts.filter(
    (a) => a.type === 'cash' || (!a.type && a.name.toLowerCase().includes('cash'))
  );

  const onlineSavingsPaise = onlineSavingsVaults.reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);
  const cashSavingsPaise = cashSavingsVaults.reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  // Modals & Forms State
  // 1. Create Vault
  const [isCreatingVault, setIsCreatingVault] = useState<boolean>(false);
  const [newVaultName, setNewVaultName] = useState<string>('');
  const [newVaultType, setNewVaultType] = useState<'bank' | 'cash'>('bank');
  const [newVaultTarget, setNewVaultTarget] = useState<string>('');
  const [newVaultInitialDeposit, setNewVaultInitialDeposit] = useState<string>('');
  const [newVaultDepositSourceId, setNewVaultDepositSourceId] = useState<string>(onlineSpendingAccount?.id ?? '');

  // 2. Edit Vault
  const [editingVault, setEditingVault] = useState<DashboardAccount | null>(null);
  const [editVaultName, setEditVaultName] = useState<string>('');
  const [editVaultType, setEditVaultType] = useState<'bank' | 'cash'>('bank');
  const [editVaultTarget, setEditVaultTarget] = useState<string>('');

  // 3. Delete Vault
  const [deletingVault, setDeletingVault] = useState<DashboardAccount | null>(null);
  const [deleteTransferToId, setDeleteTransferToId] = useState<string>(onlineSpendingAccount?.id ?? '');
  const [transferRemainingFunds, setTransferRemainingFunds] = useState<boolean>(true);

  // 4. Deposit / Withdraw Modal
  const [activeTransferAccount, setActiveTransferAccount] = useState<DashboardAccount | null>(null);
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [transferAmountInput, setTransferAmountInput] = useState<string>('500');
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>(
    defaultSpendingAccount?.id ?? ''
  );

  // 5. Reconcile Modal
  const [activeReconcileAccount, setActiveReconcileAccount] = useState<DashboardAccount | null>(null);
  const [reconcileRupeesInput, setReconcileRupeesInput] = useState<string>('');

  // 6. Set Target Goal Modal
  const [activeGoalAccount, setActiveGoalAccount] = useState<DashboardAccount | null>(null);
  const [goalAmountInput, setGoalAmountInput] = useState<string>('');

  // 7. UPI Settings & Quick Save
  const [isEditingUpi, setIsEditingUpi] = useState<boolean>(false);
  const [upiInput, setUpiInput] = useState<string>(savingsUpiId ?? '');
  const [quickSaveAmount, setQuickSaveAmount] = useState<number>(500);
  const [customSaveAmount, setCustomSaveAmount] = useState<string>('');
  const [selectedSavingsAccountId, setSelectedSavingsAccountId] = useState<string>(
    savingsAccounts[0]?.id ?? ''
  );
  const [upiConfirmModal, setUpiConfirmModal] = useState<{
    amountRupees: number;
    savingsAccount: DashboardAccount;
  } | null>(null);

  // 8. In-App Quick Deposit Widget State
  const [directDepositAmount, setDirectDepositAmount] = useState<string>('500');
  const [directDepositVaultId, setDirectDepositVaultId] = useState<string>(savingsAccounts[0]?.id ?? '');
  const [directDepositSourceId, setDirectDepositSourceId] = useState<string>(defaultSpendingAccount?.id ?? '');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // General Status Messages
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

  // Transfer validation calculation
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

  // Handler: Create Vault
  const handleCreateVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newVaultName.trim();
    if (!cleanName) {
      showFeedback(isHindi ? 'कृपया तिजोरी का नाम दर्ज करें' : 'Please enter a vault name', true);
      return;
    }

    const parsedTarget = newVaultTarget.trim() === '' ? null : Number(newVaultTarget);
    if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0)) {
      showFeedback(isHindi ? 'अमान्य लक्ष्य राशि' : 'Invalid target amount', true);
      return;
    }

    const parsedDeposit = newVaultInitialDeposit.trim() === '' ? 0 : Number(newVaultInitialDeposit);
    if (parsedDeposit < 0 || !Number.isFinite(parsedDeposit)) {
      showFeedback(isHindi ? 'अमान्य शुरुआती जमा राशि' : 'Invalid initial deposit amount', true);
      return;
    }

    if (parsedDeposit > 0) {
      const sourceAcc = accounts.find((a) => a.id === newVaultDepositSourceId);
      if (sourceAcc && sourceAcc.current_balance_paise < Math.round(parsedDeposit * 100)) {
        showFeedback(
          isHindi
            ? `${sourceAcc.name} में अपर्याप्त बैलेंस है! उपलब्ध: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`
            : `Insufficient balance in ${sourceAcc.name}! Available: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`,
          true
        );
        return;
      }
    }

    setLoading(true);
    try {
      await onCreateSavingsAccount(
        cleanName,
        newVaultType,
        parsedTarget,
        parsedDeposit > 0 ? parsedDeposit : undefined,
        parsedDeposit > 0 ? newVaultDepositSourceId : undefined
      );

      showFeedback(
        isHindi
          ? `नई तिजोरी "${cleanName}" सफलता से बनाई गई!`
          : `New vault "${cleanName}" created successfully!`
      );
      setIsCreatingVault(false);
      setNewVaultName('');
      setNewVaultTarget('');
      setNewVaultInitialDeposit('');
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to create vault', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Edit Vault
  const handleEditVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVault) return;
    const cleanName = editVaultName.trim();
    if (!cleanName) {
      showFeedback(isHindi ? 'कृपया तिजोरी का नाम दर्ज करें' : 'Please enter a vault name', true);
      return;
    }

    const parsedTarget = editVaultTarget.trim() === '' ? null : Number(editVaultTarget);
    if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0)) {
      showFeedback(isHindi ? 'अमान्य लक्ष्य राशि' : 'Invalid target amount', true);
      return;
    }

    setLoading(true);
    try {
      if (onUpdateAccount) {
        await onUpdateAccount(editingVault.id, {
          name: cleanName,
          type: editVaultType,
          targetGoalRupees: parsedTarget,
        });
      } else {
        await onUpdateGoal(editingVault.id, parsedTarget);
      }

      showFeedback(isHindi ? 'तिजोरी अपडेट हो गई!' : 'Vault updated successfully!');
      setEditingVault(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update vault', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Delete Vault
  const handleDeleteVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingVault) return;

    setLoading(true);
    try {
      const transferDestination =
        transferRemainingFunds && deletingVault.current_balance_paise > 0
          ? deleteTransferToId
          : undefined;

      if (onDeleteAccount) {
        await onDeleteAccount(deletingVault.id, transferDestination);
      }
      showFeedback(
        isHindi
          ? `तिजोरी "${deletingVault.name}" हटा दी गई!`
          : `Vault "${deletingVault.name}" deleted successfully!`
      );
      setDeletingVault(null);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to delete vault', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: In-App Direct Deposit
  const handleDirectDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(directDepositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showFeedback(isHindi ? 'कृपया वैध राशि दर्ज करें' : 'Please enter a valid amount', true);
      return;
    }

    const targetVault = savingsAccounts.find((a) => a.id === directDepositVaultId) ?? savingsAccounts[0];
    if (!targetVault) {
      showFeedback(isHindi ? 'कोई तिजोरी नहीं मिली' : 'No vault found', true);
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === directDepositSourceId) ?? defaultSpendingAccount;
    if (!sourceAcc) {
      showFeedback(isHindi ? 'खर्च खाता नहीं मिला' : 'No spending account found', true);
      return;
    }

    const amountPaise = Math.round(amount * 100);
    if (sourceAcc.id !== targetVault.id && sourceAcc.current_balance_paise < amountPaise) {
      showFeedback(
        isHindi
          ? `${sourceAcc.name} में अपर्याप्त बैलेंस! उपलब्ध: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`
          : `Insufficient balance in ${sourceAcc.name}! Available: ₹${(Math.max(0, sourceAcc.current_balance_paise) / 100).toFixed(2)}`,
        true
      );
      return;
    }

    setLoading(true);
    try {
      await onTransfer(
        sourceAcc.id,
        targetVault.id,
        amount,
        `Deposit to ${targetVault.name}`
      );
      showFeedback(
        isHindi
          ? `₹${amount} ${targetVault.name} में सुरक्षित जमा हो गए!`
          : `₹${amount} stored in ${targetVault.name}!`
      );
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Deposit failed', true);
    } finally {
      setLoading(false);
    }
  };

  // Handler: In-App Transfer (Deposit / Withdraw)
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransferAccount) return;

    const amount = Number(transferAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      showFeedback(isHindi ? 'कृपया वैध राशि दर्ज करें' : 'Please enter a valid amount', true);
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === selectedSourceAccountId) ?? defaultSpendingAccount ?? accounts[0];
    if (!sourceAcc) {
      showFeedback(isHindi ? 'खाता नहीं मिला' : 'No account found', true);
      return;
    }

    const amountPaise = Math.round(amount * 100);

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

  // Handler: Reconcile / Set Balance
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

  // Handler: Target Goal update
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

  // Handler: Save UPI ID
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

  // Trigger External UPI Payment Intent
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
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Top Header Banner */}
      <div className="relative flex flex-col gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
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
                ? 'अपनी पसंद के अनुसार ऑनलाइन या ऑफलाइन (कैश) वॉल्ट बनाएं, संपादित करें या हटाएं।'
                : 'Create, customize, edit, and organize your Online and Offline (Cash) vaults.'}
            </p>
          </div>
        </div>

        {/* Total Locked Savings Display & Create Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-start rounded-2xl border-2 border-zinc-200 bg-zinc-50/80 px-4 py-2.5 sm:items-end dark:border-zinc-700 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'कुल सुरक्षित बचत' : 'Total Saved'}
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatINR(totalSavedPaise, { showPaise: false })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewVaultName('');
              setNewVaultType('bank');
              setNewVaultTarget('');
              setNewVaultInitialDeposit('');
              setNewVaultDepositSourceId(onlineSpendingAccount?.id ?? '');
              setIsCreatingVault(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-emerald-500 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{isHindi ? '+ नई तिजोरी बनाएं' : '+ Create Vault'}</span>
          </button>
        </div>
      </div>

      {/* Online & Offline Vault Breakdown Pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Globe className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{isHindi ? 'ऑनलाइन वॉल्ट:' : 'Online Vaults:'}</span>
          <strong>{formatINR(onlineSavingsPaise, { showPaise: false })}</strong>
          <span className="opacity-70">({onlineSavingsVaults.length})</span>
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Coins className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{isHindi ? 'ऑफलाइन (कैश) वॉल्ट:' : 'Offline (Cash) Vaults:'}</span>
          <strong>{formatINR(cashSavingsPaise, { showPaise: false })}</strong>
          <span className="opacity-70">({cashSavingsVaults.length})</span>
        </span>

        <button
          type="button"
          onClick={() => setShowExplanation((prev) => !prev)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition"
        >
          <Info className="h-3.5 w-3.5" />
          <span>{isHindi ? 'यह कैसे काम करता है?' : 'How Vaults & UPI Work'}</span>
        </button>
      </div>

      {/* Educational Explanation Banner */}
      {showExplanation && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200 animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <h5 className="font-bold flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {isHindi ? 'वॉल्ट्स और UPI बचत की जानकारी:' : 'Understanding Savings & UPI in Track Expenser:'}
              </h5>
              <p>
                <strong>{isHindi ? '1. ऐप में बचत (In-App Vaults):' : '1. In-App Savings (Direct):'}</strong>{' '}
                {isHindi
                  ? 'आप ऐप के अंदर ही पैसे जमा कर सकते हैं। अपनी जरूरत अनुसार ऑनलाइन (डिजिटल बैंक) या ऑफलाइन (नकद) तिजोरी बनाएं, और दैनिक खर्च से अलग रखें।'
                  : 'You can directly store and lock your savings in this app. Create custom Online (bank) or Offline (cash) vaults and deposit anytime.'}
              </p>
              <p>
                <strong>{isHindi ? '2. UPI ID से बचत का उद्देश्य:' : '2. Purpose of "Save via UPI ID":'}</strong>{' '}
                {isHindi
                  ? 'चूंकि कोई भी ऐप बिना बैंकिंग लाइसेंस के आपके बैंक का असली पैसा नहीं रख सकता, इसलिए यह सुविधा एक शॉर्टकट है! आप अपना दूसरा बैंक बचत खाता UPI ID दर्ज करते हैं, और सीधे Google Pay / PhonePe से असली पैसे अपने उस खाते में भेज सकते हैं, जो यहाँ दर्ज हो जाएगा।'
                  : 'An expense app cannot legally hold banking deposits directly in India. The "Save via UPI" feature is a direct shortcut that opens your payment app (GPay / PhonePe) to transfer real rupees into your actual bank savings account and automatically records it here.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowExplanation(false)}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
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

      {/* In-App Direct Deposit Widget */}
      {savingsAccounts.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
          <form onSubmit={handleDirectDepositSubmit} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? 'सीधे तिजोरी में बचत जमा करें' : 'Quick Deposit into Vault'}
                </h4>
              </div>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {isHindi ? 'दैनिक खर्च से तिजोरी में सुरक्षित रखें' : 'Transfer instantly from spending to vault'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:items-center">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  {isHindi ? 'किस तिजोरी में:' : 'Target Vault:'}
                </label>
                <select
                  value={directDepositVaultId}
                  onChange={(e) => setDirectDepositVaultId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white p-2 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {savingsAccounts.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.type === 'cash' ? (isHindi ? 'ऑफलाइन/कैश' : 'Cash') : (isHindi ? 'ऑनलाइन' : 'Online')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  {isHindi ? 'स्रोत खाता:' : 'From Spending:'}
                </label>
                <select
                  value={directDepositSourceId}
                  onChange={(e) => setDirectDepositSourceId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white p-2 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {spendingAccounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {formatINR(Math.max(0, s.current_balance_paise), { showPaise: false })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  {isHindi ? 'रकम (₹):' : 'Amount (₹):'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={directDepositAmount}
                  onChange={(e) => setDirectDepositAmount(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 text-sm font-black text-zinc-900 focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div className="pt-4 sm:pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{loading ? '...' : isHindi ? 'जमा करें' : 'Deposit Now'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Your Vaults Cards List */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {isHindi ? 'आपकी तिजोरियां' : 'Your Vaults'} ({savingsAccounts.length})
          </h4>
          <button
            type="button"
            onClick={() => {
              setNewVaultName('');
              setNewVaultType('bank');
              setNewVaultTarget('');
              setNewVaultInitialDeposit('');
              setNewVaultDepositSourceId(onlineSpendingAccount?.id ?? '');
              setIsCreatingVault(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isHindi ? '+ नई तिजोरी बनाएं' : '+ Create Vault'}</span>
          </button>
        </div>

        {savingsAccounts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">
              {isHindi ? 'कोई बचत तिजोरी नहीं है' : 'No savings vaults created yet'}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi
                ? 'अपनी बचत अलग रखने के लिए एक ऑनलाइन या ऑफलाइन (कैश) वॉल्ट बनाएं।'
                : 'Create an Online or Offline vault to start ring-fencing your savings.'}
            </p>
            <button
              type="button"
              onClick={() => setIsCreatingVault(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isHindi ? 'पहली तिजोरी बनाएं' : 'Create First Vault'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {savingsAccounts.map((acc) => {
              const currentRupees = Math.max(0, acc.current_balance_paise) / 100;
              const targetRupees = acc.target_goal_paise ? acc.target_goal_paise / 100 : null;
              const progressPercent =
                targetRupees && targetRupees > 0
                  ? Math.min(100, Math.round((currentRupees / targetRupees) * 100))
                  : null;
              const isCashVault = acc.type === 'cash' || (!acc.type && acc.name.toLowerCase().includes('cash'));

              return (
                <div
                  key={acc.id}
                  className={`flex flex-col justify-between rounded-2xl border-2 p-5 shadow-xs transition ${
                    isCashVault
                      ? 'border-emerald-200 bg-linear-to-b from-emerald-50/50 to-white dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-zinc-900'
                      : 'border-indigo-200 bg-linear-to-b from-indigo-50/50 to-white dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-zinc-900'
                  }`}
                >
                  <div>
                    {/* Header: Icon, Name, Type, and Edit/Delete controls */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            isCashVault
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                          }`}
                        >
                          {isCashVault ? <Coins className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{acc.name}</h5>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isCashVault
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300'
                              }`}
                            >
                              {isCashVault ? (isHindi ? '💵 ऑफलाइन' : '💵 Cash') : (isHindi ? '🌐 ऑनलाइन' : '🌐 Online')}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            {isCashVault
                              ? isHindi ? 'नकद / तिजोरी बचत' : 'Physical Cash Reserve'
                              : isHindi ? 'डिजिटल बैंक बचत' : 'Digital Bank Reserve'}
                          </span>
                        </div>
                      </div>

                      {/* Edit & Delete Action Icons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVault(acc);
                            setEditVaultName(acc.name);
                            setEditVaultType(acc.type === 'cash' ? 'cash' : 'bank');
                            setEditVaultTarget(targetRupees ? targetRupees.toString() : '');
                          }}
                          title={isHindi ? 'तिजोरी संपादित करें' : 'Edit Vault'}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeletingVault(acc);
                            setDeleteTransferToId(isCashVault ? (cashSpendingAccount?.id ?? accounts[0]?.id) : (onlineSpendingAccount?.id ?? accounts[0]?.id));
                            setTransferRemainingFunds(true);
                          }}
                          title={isHindi ? 'तिजोरी हटाएं' : 'Delete Vault'}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {isHindi ? 'सुरक्षित बैलेंस:' : 'Current Balance:'}
                        </span>
                        <div className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                          {formatINR(Math.max(0, acc.current_balance_paise), { showPaise: false })}
                        </div>
                      </div>

                      {/* Target Goal Pill */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGoalAccount(acc);
                          setGoalAmountInput(targetRupees ? targetRupees.toString() : '');
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border-2 border-zinc-300 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-zinc-700 shadow-2xs hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        title={isHindi ? 'लक्ष्य बदलें' : 'Set Goal'}
                      >
                        <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {targetRupees ? `₹${targetRupees.toLocaleString('en-IN')}` : isHindi ? '+ लक्ष्य जोड़ें' : '+ Add Goal'}
                        </span>
                        {progressPercent !== null && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                            ({progressPercent}%)
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Goal Progress Bar */}
                    {progressPercent !== null && (
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions: Deposit / Withdraw / Set Balance */}
                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTransferAccount(acc);
                          setTransferMode('deposit');
                          setTransferAmountInput('500');
                          const defaultSrc = isCashVault
                            ? cashSpendingAccount?.id ?? spendingAccounts[0]?.id
                            : onlineSpendingAccount?.id ?? spendingAccounts[0]?.id;
                          setSelectedSourceAccountId(defaultSrc ?? accounts[0]?.id ?? '');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
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
                            ? cashSpendingAccount?.id ?? spendingAccounts[0]?.id
                            : onlineSpendingAccount?.id ?? spendingAccounts[0]?.id;
                          setSelectedSourceAccountId(defaultDest ?? accounts[0]?.id ?? '');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition"
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
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                      >
                        {isHindi ? 'बैलेंस सेट करें' : 'Set Balance'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Optional: UPI Quick Save Section */}
      <div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'वैकल्पिक: UPI ऐप से बचत करें' : 'Optional: Save via UPI App'}
            </h4>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {savingsUpiId ? (
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">UPI ID:</span>
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

        {isEditingUpi && (
          <form onSubmit={handleSaveUpi} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={upiInput}
              onChange={(e) => setUpiInput(e.target.value)}
              placeholder="e.g. yourname@okhdfcbank"
              className="flex-1 rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'सुरक्षित करें' : 'Save UPI ID'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingUpi(false)}
                className="rounded-xl bg-zinc-200 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'border-2 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                + ₹{amt}
              </button>
            );
          })}

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-bold text-zinc-500 dark:text-zinc-400">
              ₹
            </span>
            <input
              type="number"
              placeholder={isHindi ? 'अन्य' : 'Custom'}
              value={customSaveAmount}
              onChange={(e) => setCustomSaveAmount(e.target.value)}
              className="w-24 rounded-xl border-2 border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-xs font-bold text-zinc-900 placeholder-zinc-400 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              min="1"
            />
          </div>

          <button
            type="button"
            onClick={handleTriggerUpiPay}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500"
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

      {/* MODAL 1: Create New Vault */}
      {isCreatingVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? 'नई बचत तिजोरी बनाएं' : 'Create New Savings Vault'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingVault(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVaultSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'तिजोरी का नाम (उदा. इमरजेंसी, सोना, ट्रिप):' : 'Vault Name (e.g. Emergency Fund, Trip, Gold):'}
                </label>
                <input
                  type="text"
                  required
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="e.g. Emergency Fund"
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'तिजोरी का प्रकार (ऑनलाइन या ऑफलाइन कैश):' : 'Vault Type (Online or Offline Cash):'}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewVaultType('bank');
                      setNewVaultDepositSourceId(onlineSpendingAccount?.id ?? '');
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-2.5 text-xs font-bold transition ${
                      newVaultType === 'bank'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span>{isHindi ? 'ऑनलाइन (बैंक/UPI)' : 'Online (Bank/UPI)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewVaultType('cash');
                      setNewVaultDepositSourceId(cashSpendingAccount?.id ?? '');
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-2.5 text-xs font-bold transition ${
                      newVaultType === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    <span>{isHindi ? 'ऑफलाइन (कैश)' : 'Offline (Cash)'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'लक्ष्य राशि ₹ (वैकल्पिक):' : 'Target Goal Amount ₹ (Optional):'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={newVaultTarget}
                  onChange={(e) => setNewVaultTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'अभी शुरुआत में पैसे जमा करें ₹ (वैकल्पिक):' : 'Initial Deposit Amount ₹ (Optional):'}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newVaultInitialDeposit}
                    onChange={(e) => setNewVaultInitialDeposit(e.target.value)}
                    placeholder="e.g. 1000"
                    className="flex-1 rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  {Number(newVaultInitialDeposit) > 0 && (
                    <select
                      value={newVaultDepositSourceId}
                      onChange={(e) => setNewVaultDepositSourceId(e.target.value)}
                      className="rounded-xl border-2 border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      {spendingAccounts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingVault(false)}
                  className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? '...' : isHindi ? 'तिजोरी बनाएं' : 'Create Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Vault */}
      {editingVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? `तिजोरी संपादित करें: ${editingVault.name}` : `Edit Vault: ${editingVault.name}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingVault(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditVaultSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'तिजोरी का नाम:' : 'Vault Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={editVaultName}
                  onChange={(e) => setEditVaultName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'प्रकार (ऑनलाइन या ऑफलाइन):' : 'Type (Online or Offline):'}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVaultType('bank')}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-2.5 text-xs font-bold transition ${
                      editVaultType === 'bank'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span>{isHindi ? 'ऑनलाइन (बैंक/UPI)' : 'Online (Bank/UPI)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVaultType('cash')}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-2.5 text-xs font-bold transition ${
                      editVaultType === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    <span>{isHindi ? 'ऑफलाइन (कैश)' : 'Offline (Cash)'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'लक्ष्य राशि ₹ (हटाने के लिए खाली छोड़ें):' : 'Target Goal ₹ (leave blank to remove):'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={editVaultTarget}
                  onChange={(e) => setEditVaultTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVault(null)}
                  className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {isHindi ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? '...' : isHindi ? 'सहेजें' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Vault Confirmation */}
      {deletingVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto mb-3 dark:bg-rose-950/60 dark:text-rose-400">
              <Trash2 className="h-6 w-6 stroke-[2.2]" />
            </div>

            <h4 className="text-center text-base font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? `क्या आप "${deletingVault.name}" को हटाना चाहते हैं?` : `Delete vault "${deletingVault.name}"?`}
            </h4>

            {deletingVault.current_balance_paise > 0 ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {isHindi
                      ? `इस तिजोरी में अभी ${formatINR(deletingVault.current_balance_paise)} बचे हैं!`
                      : `This vault still has ${formatINR(deletingVault.current_balance_paise)} saved!`}
                  </span>
                </p>

                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={transferRemainingFunds}
                      onChange={(e) => setTransferRemainingFunds(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{isHindi ? 'बचे हुए पैसे को खर्च खाते में वापस भेजें' : 'Transfer remaining funds to spending account'}</span>
                  </label>

                  {transferRemainingFunds && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                        {isHindi ? 'किस खाते में भेजें:' : 'Destination Account:'}
                      </label>
                      <select
                        value={deleteTransferToId}
                        onChange={(e) => setDeleteTransferToId(e.target.value)}
                        className="mt-1 w-full rounded-xl border-2 border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        {spendingAccounts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({formatINR(Math.max(0, s.current_balance_paise), { showPaise: false })})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
                {isHindi ? 'यह तिजोरी खाली है और इसे सुरक्षित रूप से हटाया जा सकता है।' : 'This vault is currently empty and can be safely removed.'}
              </p>
            )}

            <form onSubmit={handleDeleteVaultSubmit} className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingVault(null)}
                className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {isHindi ? 'रद्द' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {loading ? '...' : isHindi ? 'हाँ, हटाएं' : 'Delete Vault'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Transfer (Deposit / Withdraw) */}
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
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
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
                  className={`mt-1.5 w-full rounded-xl border-2 px-3.5 py-2.5 text-lg font-black text-zinc-900 focus:outline-hidden dark:text-zinc-50 ${
                    isVaultInsufficient
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 focus:border-rose-500'
                      : 'border-zinc-300 bg-white focus:border-emerald-600 dark:border-zinc-600 dark:bg-zinc-800'
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

      {/* MODAL 5: Reconcile / Set Balance */}
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
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-base font-black text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
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

      {/* MODAL 6: Edit Target Goal */}
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
                  className="mt-1.5 w-full rounded-xl border-2 border-zinc-300 bg-white px-3.5 py-2.5 text-base font-bold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  autoFocus
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

      {/* MODAL 7: Post-UPI Confirmation Dialog */}
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
