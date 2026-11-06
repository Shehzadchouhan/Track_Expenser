'use client';

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { Navbar } from '@/components/Navbar';
import { AccountCards, DashboardAccount } from '@/components/AccountCards';
import { TransactionFeed, DisplayTransaction } from '@/components/TransactionFeed';
import { CategoryBreakdown, CategorySpendItem } from '@/components/CategoryBreakdown';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { ResetModal, ResetScope } from '@/components/ResetModal';
import { AuthModal } from '@/components/AuthModal';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { formatINR } from '@/lib/money';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  getSavedLanguage,
  getServerLanguage,
  saveLanguage,
  subscribeToLanguage,
} from '@/lib/i18n';
import {
  Calendar,
  Layers,
  RotateCcw,
  Zap,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Camera,
  Coins,
  WalletCards,
} from 'lucide-react';

function isDisplayTransaction(value: unknown): value is DisplayTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const transaction = value as Record<string, unknown>;
  return (
    typeof transaction.id === 'string' &&
    (transaction.type === 'income' || transaction.type === 'expense' || transaction.type === 'transfer') &&
    typeof transaction.amount_paise === 'number' &&
    Number.isFinite(transaction.amount_paise) &&
    typeof transaction.source === 'string' &&
    ['web', 'whatsapp_text', 'whatsapp_image'].includes(transaction.source) &&
    typeof transaction.occurred_at === 'string'
  );
}

export default function Home() {
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [startingBalanceRupees, setStartingBalanceRupees] = useState<number>(0);
  const [monthlyBudgetPaise, setMonthlyBudgetPaise] = useState<number>(2500000); // Default ₹25,000
  const [accounts, setAccounts] = useState<DashboardAccount[]>([
    {
      id: 'default-bank',
      name: 'Bank / UPI',
      type: 'bank',
      purpose: 'spending',
      is_default: true,
      opening_balance_paise: 0,
      target_goal_paise: null,
      current_balance_paise: 0,
    },
    {
      id: 'default-cash',
      name: 'Cash',
      type: 'cash',
      purpose: 'spending',
      is_default: false,
      opening_balance_paise: 0,
      target_goal_paise: null,
      current_balance_paise: 0,
    },
    {
      id: 'default-online-vault',
      name: 'Online Vault',
      type: 'bank',
      purpose: 'savings',
      is_default: false,
      opening_balance_paise: 0,
      target_goal_paise: 5000000,
      current_balance_paise: 0,
    },
    {
      id: 'default-cash-vault',
      name: 'Cash Vault',
      type: 'cash',
      purpose: 'savings',
      is_default: false,
      opening_balance_paise: 0,
      target_goal_paise: 2000000,
      current_balance_paise: 0,
    },
  ]);
  const [savingsUpiId, setSavingsUpiId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Shared Receipt / Screenshot state (Web Share Target or Camera scan)
  const [sharedReceiptData, setSharedReceiptData] = useState<{
    amountRupees?: number;
    merchant?: string;
    category?: string;
    note?: string;
  } | null>(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const receiptFileInputRef = React.useRef<HTMLInputElement>(null);

  const language = useSyncExternalStore(
    subscribeToLanguage,
    getSavedLanguage,
    getServerLanguage
  );
  const isHindi = language === 'hi';

  // Time Horizon Cycle Filter: 'weekly' | 'monthly' | 'all'
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'all'>('monthly');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const isFetchingRef = React.useRef(false);

  // The server resolves account identity from the Supabase session cookie.
  const loadDashboardData = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return false;
    isFetchingRef.current = true;
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          setUserEmail(null);
        }
        return false;
      }
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        setUserEmail(data.email || null);
        if (data.monthlyBudgetPaise) {
          setMonthlyBudgetPaise(data.monthlyBudgetPaise);
        }
        if (typeof data.startingBalancePaise === 'number') {
          setStartingBalanceRupees(data.startingBalancePaise / 100);
        }
        if (typeof data.savingsUpiId !== 'undefined') {
          setSavingsUpiId(data.savingsUpiId);
        }
        if (Array.isArray(data.accounts) && data.accounts.length > 0) {
          setAccounts((prev) => {
            // Apply server accounts, preserving optimistic delta of any in-flight manual transactions
            const pendingManual = transactions.filter((t) => t.id.startsWith('manual-'));
            if (pendingManual.length === 0) return data.accounts;

            return data.accounts.map((acc: DashboardAccount) => {
              let bal = acc.current_balance_paise;
              pendingManual.forEach((m) => {
                if (m.type === 'expense' && m.account_id === acc.id) bal -= m.amount_paise;
                if (m.type === 'income' && m.account_id === acc.id) bal += m.amount_paise;
                if (m.type === 'transfer') {
                  if (m.account_id === acc.id && m.transfer_to_account_id === acc.id) bal += m.amount_paise;
                  else {
                    if (m.account_id === acc.id) bal -= m.amount_paise;
                    if (m.transfer_to_account_id === acc.id) bal += m.amount_paise;
                  }
                }
              });
              return { ...acc, current_balance_paise: bal };
            });
          });
        }
        if (Array.isArray(data.transactions)) {
          setTransactions((prev) => {
            const pendingManual = prev.filter((t) => t.id.startsWith('manual-'));
            if (pendingManual.length === 0) return data.transactions;
            const existingIds = new Set(data.transactions.map((t: any) => t.id));
            const stillPending = pendingManual.filter((t) => !existingIds.has(t.id));
            return [...stillPending, ...data.transactions];
          });
        }

        // Cache to localStorage for instant mobile loading on future launches
        try {
          localStorage.setItem(
            'track_expenser_cached_dashboard',
            JSON.stringify({
              authenticated: true,
              email: data.email || null,
              accounts: data.accounts,
              transactions: data.transactions,
              startingBalancePaise: data.startingBalancePaise,
              monthlyBudgetPaise: data.monthlyBudgetPaise,
            })
          );
          if (Array.isArray(data.transactions)) {
            localStorage.setItem('track_expenser_transactions', JSON.stringify(data.transactions));
          }
          if (Array.isArray(data.accounts)) {
            localStorage.setItem('track_expenser_accounts', JSON.stringify(data.accounts));
          }
        } catch {}

        return true;
      }
      setIsAuthenticated(false);
      setUserEmail(null);
      return false;
    } catch {
      return false;
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Set up client-side Supabase auth listener (handles Magic Links, OTPs, hash fragments #access_token=...)
  useEffect(() => {
    let client: ReturnType<typeof createBrowserSupabaseClient> | null = null;
    try {
      client = createBrowserSupabaseClient();
    } catch {
      // Ignore if Supabase env is not configured in client
    }

    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setUserEmail(session.user?.email || null);
        await loadDashboardData(true);
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } else if (_event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserEmail(null);
        try {
          localStorage.removeItem('track_expenser_cached_dashboard');
        } catch {}
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadDashboardData]);

  // Instantaneous Mobile Restore: synchronously load local cache first, then sync in background
  useEffect(() => {
    // 1. Immediately read cached dashboard for 0ms mobile render
    try {
      const cached = localStorage.getItem('track_expenser_cached_dashboard');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.authenticated) {
          setIsAuthenticated(true);
          if (parsed.email) setUserEmail(parsed.email);
        }
        if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          setAccounts(parsed.accounts);
        }
        if (Array.isArray(parsed.transactions)) {
          const validTx = parsed.transactions.filter(isDisplayTransaction);
          if (validTx.length > 0) {
            setTransactions(validTx);
          }
        }
        if (typeof parsed.startingBalancePaise === 'number') {
          setStartingBalanceRupees(parsed.startingBalancePaise / 100);
        }
        if (parsed.monthlyBudgetPaise) {
          setMonthlyBudgetPaise(parsed.monthlyBudgetPaise);
        }
      }
    } catch {}

    // 2. Read local guest state (starting balance, cycle, local records)
    try {
      const savedTransactions = localStorage.getItem('track_expenser_transactions');
      if (savedTransactions) {
        const parsed = JSON.parse(savedTransactions);
        if (Array.isArray(parsed)) {
          const validTx = parsed.filter(isDisplayTransaction);
          if (validTx.length > 0) {
            setTransactions((prev) => {
              if (prev.length === 0 || validTx.length >= prev.length) {
                return validTx;
              }
              return prev;
            });
          }
        }
      }

      const savedAccounts = localStorage.getItem('track_expenser_accounts');
      if (savedAccounts) {
        const parsedAcc = JSON.parse(savedAccounts);
        if (Array.isArray(parsedAcc) && parsedAcc.length > 0) {
          setAccounts(parsedAcc);
        }
      }

      const savedStartingBalance = localStorage.getItem('track_expenser_starting_balance');
      if (savedStartingBalance) {
        const parsedBalance = Number.parseFloat(savedStartingBalance);
        if (Number.isFinite(parsedBalance) && parsedBalance >= 0) {
          setStartingBalanceRupees(parsedBalance);
        }
      }

      const savedCycle = localStorage.getItem('track_expenser_cycle');
      if (savedCycle && ['weekly', 'monthly', 'all'].includes(savedCycle)) {
        setTimeRange(savedCycle as 'weekly' | 'monthly' | 'all');
      }
    } catch (err) {
      console.warn('[Dashboard] Local storage restore error:', err);
    }

    // 3. Catch Web Share Target or UPI receipt redirect query params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedAmountPaise = params.get('shared_amount');
      const openScanner = params.get('open_scanner');

      if (sharedAmountPaise || openScanner) {
        const sessionKey = `track_expenser_consumed_${sharedAmountPaise || 'scan'}_${params.get('shared_merchant') || ''}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1');

          const paise = sharedAmountPaise ? Number(sharedAmountPaise) : undefined;
          const rupees = paise && Number.isFinite(paise) && paise > 0 ? paise / 100 : undefined;
          const merchant = params.get('shared_merchant') || undefined;
          const category = params.get('shared_category') || undefined;
          const note = params.get('shared_note') || undefined;
          const type = params.get('shared_type');

          if (type === 'income' || type === 'expense' || type === 'transfer') {
            setNewTransactionType(type);
          } else {
            setNewTransactionType('expense');
          }

          setSharedReceiptData({
            amountRupees: rupees,
            merchant,
            category,
            note,
          });
          setIsAddModalOpen(true);
        }

        // Clean up URL parameters immediately so refresh never re-opens with the same transaction
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // 4. Background refresh with live Supabase data
    void loadDashboardData();
  }, [loadDashboardData]);

  // Periodic polling when tab is active (15s live pulse)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void loadDashboardData();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadDashboardData]);

  // Cycle range start dates
  const { startOfWeek, startOfMonth, cycleRangeLabel } = useMemo(() => {
    const now = new Date();

    // Start of week (Monday 00:00:00)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const sow = new Date(now);
    sow.setDate(diff);
    sow.setHours(0, 0, 0, 0);

    // Start of month (1st of month 00:00:00)
    const som = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    let label = '';
    if (timeRange === 'weekly') {
      const sowFormatted = sow.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const nowFormatted = now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      label = `Week of ${sowFormatted} – ${nowFormatted}`;
    } else if (timeRange === 'monthly') {
      label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } else {
      label = 'All Recorded History';
    }

    return { startOfWeek: sow, startOfMonth: som, cycleRangeLabel: label };
  }, [timeRange]);

  // Filter transactions based on active cycle
  const cycleTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tDate = new Date(t.occurred_at);
      if (timeRange === 'weekly') {
        return tDate >= startOfWeek;
      }
      if (timeRange === 'monthly') {
        return tDate >= startOfMonth;
      }
      return true;
    });
  }, [transactions, timeRange, startOfWeek, startOfMonth]);

  // Handle cycle switch with persistence
  const handleCycleChange = (range: 'weekly' | 'monthly' | 'all') => {
    setTimeRange(range);
    localStorage.setItem('track_expenser_cycle', range);
  };

  const handleLanguageChange = saveLanguage;

  // Compute spend stats (transfers are excluded)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Liquid / Spending balances
  const onlineSpendingPaise = accounts
    .filter((a) => a.purpose === 'spending' && (a.type === 'bank' || a.type === 'wallet'))
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  const cashSpendingPaise = accounts
    .filter((a) => a.purpose === 'spending' && a.type === 'cash')
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  const totalSpendingBalancePaise = onlineSpendingPaise + cashSpendingPaise;

  // Vault / Savings balances (2 Distinct Vaults: Online Vault & Cash Vault)
  const onlineSavingsPaise = accounts
    .filter((a) => a.purpose === 'savings' && (a.type === 'bank' || a.name.toLowerCase().includes('online')))
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  const cashSavingsPaise = accounts
    .filter((a) => a.purpose === 'savings' && (a.type === 'cash' || a.name.toLowerCase().includes('cash')))
    .reduce((sum, a) => sum + Math.max(0, a.current_balance_paise), 0);

  const totalSavingsBalancePaise = onlineSavingsPaise + cashSavingsPaise;

  // Income Breakdown in cycle (Online vs Cash)
  const cycleIncomePaise = cycleTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const cycleOnlineIncomePaise = cycleTransactions
    .filter((t) => {
      if (t.type !== 'income') return false;
      const acc = accounts.find((a) => a.id === t.account_id);
      return !acc || acc.type === 'bank' || acc.type === 'wallet';
    })
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const cycleCashIncomePaise = cycleTransactions
    .filter((t) => {
      if (t.type !== 'income') return false;
      const acc = accounts.find((a) => a.id === t.account_id);
      return acc?.type === 'cash';
    })
    .reduce((sum, t) => sum + t.amount_paise, 0);

  // Spending Breakdown in cycle (Online vs Cash)
  const cycleSpentPaise = cycleTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const cycleOnlineSpentPaise = cycleTransactions
    .filter((t) => {
      if (t.type !== 'expense') return false;
      const acc = accounts.find((a) => a.id === t.account_id);
      return !acc || acc.type === 'bank' || acc.type === 'wallet';
    })
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const cycleCashSpentPaise = cycleTransactions
    .filter((t) => {
      if (t.type !== 'expense') return false;
      const acc = accounts.find((a) => a.id === t.account_id);
      return acc?.type === 'cash';
    })
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const todayTransactions = transactions.filter(
    (t) => t.type === 'expense' && new Date(t.occurred_at) >= todayStart
  );
  const todaySpendPaise = todayTransactions.reduce((sum, t) => sum + t.amount_paise, 0);

  // Calculate Category Breakdown based on cycle expenses
  const categoryMap = new Map<string, CategorySpendItem>();
  DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense').forEach((c) => {
    categoryMap.set(c.name, {
      id: c.name,
      name: c.name,
      color: c.color,
      spendPaise: 0,
      count: 0,
    });
  });

  cycleTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const name = t.category_name || 'Other Expense';
      const existing = categoryMap.get(name) || {
        id: name,
        name,
        color: t.category_color || '#64748B',
        spendPaise: 0,
        count: 0,
      };
      existing.spendPaise += t.amount_paise;
      existing.count += 1;
      categoryMap.set(name, existing);
    });

  const categoryItems = Array.from(categoryMap.values()).filter((c) => c.spendPaise > 0);

  const handleUpdateBudget = async (newBudgetRupees: number) => {
    const paise = Math.round(newBudgetRupees * 100);

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_budget',
            monthlyBudgetPaise: paise,
          }),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Could not save the budget.');
        }
      } catch (error) {
        console.error('[Dashboard] Failed to persist budget update:', error);
        window.alert('Could not save the budget. Please try again.');
        return;
      }
    }

    setMonthlyBudgetPaise(paise);
  };

  const handleUpdateStartingBalance = async (newBalance: number) => {
    const newBalancePaise = Math.round(newBalance * 100);
    setStartingBalanceRupees(newBalance);
    localStorage.setItem('track_expenser_starting_balance', newBalance.toString());

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === 'default-bank' || (acc.type === 'bank' && acc.is_default)
          ? {
              ...acc,
              opening_balance_paise: newBalancePaise,
              current_balance_paise: newBalancePaise,
            }
          : acc
      )
    );

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_starting_balance',
            startingBalancePaise: newBalancePaise,
          }),
        });
        if (response.status === 401) {
          setIsAuthenticated(false);
          setUserEmail(null);
          return;
        }
        void loadDashboardData();
      } catch (error) {
        console.error('[Dashboard] Failed to save starting balance:', error);
      }
    }
  };

  // Reconcile account balance
  const handleReconcileAccount = async (accountId: string, actualRupees: number) => {
    const actual_balance_paise = Math.round(actualRupees * 100);

    const updatedAccounts = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, current_balance_paise: actual_balance_paise } : acc
    );
    setAccounts(updatedAccounts);
    try {
      localStorage.setItem('track_expenser_accounts', JSON.stringify(updatedAccounts));
    } catch {}

    if (isAuthenticated) {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_account',
          account_id: accountId,
          actual_balance_paise,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reconcile balance.');
      }
      void loadDashboardData(true);
    }
  };

  const handleUpdateSavingsUpi = async (upiId: string) => {
    if (isAuthenticated) {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_savings_upi',
          savings_upi_id: upiId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update savings UPI ID');
      }
    }
    setSavingsUpiId(upiId || null);
  };

  const handleUpdateAccountGoal = async (accountId: string, targetGoalRupees: number | null) => {
    const target_goal_paise = targetGoalRupees !== null ? Math.round(targetGoalRupees * 100) : null;
    if (isAuthenticated) {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_account_goal',
          account_id: accountId,
          target_goal_paise,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update savings goal');
      }
      void loadDashboardData();
    } else {
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === accountId ? { ...acc, target_goal_paise } : acc))
      );
    }
  };

  const handleCreateSavingsAccount = async (name: string, targetGoalRupees: number | null) => {
    const target_goal_paise = targetGoalRupees !== null ? Math.round(targetGoalRupees * 100) : null;
    if (isAuthenticated) {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_account',
          name,
          type: 'bank',
          purpose: 'savings',
          opening_balance_paise: 0,
          target_goal_paise,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create savings goal');
      }
      void loadDashboardData();
    } else {
      const newAcc: DashboardAccount = {
        id: `local-savings-${Date.now()}`,
        name,
        type: 'bank',
        purpose: 'savings',
        is_default: false,
        opening_balance_paise: 0,
        target_goal_paise,
        current_balance_paise: 0,
      };
      setAccounts((prev) => [...prev, newAcc]);
    }
  };

  const handleTransferFunds = async (
    fromAccountId: string,
    toAccountId: string,
    amountRupees: number,
    note?: string
  ) => {
    await handleAddTransaction({
      type: 'transfer',
      amountRupees,
      accountId: fromAccountId,
      transferToAccountId: toAccountId,
      note,
    });
  };

  // Permanently delete transaction from Supabase and UI
  const handleDeleteTransaction = async (id: string) => {
    const deletedTx = transactions.find((t) => t.id === id);
    const updated = transactions.filter((transaction) => transaction.id !== id);
    setTransactions(updated);

    let updatedAccounts = accounts;
    if (deletedTx) {
      const sourceAccId = deletedTx.account_id || accounts[0]?.id;
      updatedAccounts = accounts.map((acc) => {
        let bal = acc.current_balance_paise;
        if (deletedTx.type === 'expense' && acc.id === sourceAccId) {
          bal += deletedTx.amount_paise;
        } else if (deletedTx.type === 'income' && acc.id === sourceAccId) {
          bal -= deletedTx.amount_paise;
        } else if (deletedTx.type === 'transfer') {
          if (acc.id === sourceAccId) {
            bal += deletedTx.amount_paise;
          } else if (acc.id === deletedTx.transfer_to_account_id) {
            bal -= deletedTx.amount_paise;
          }
        }
        return { ...acc, current_balance_paise: bal };
      });
      setAccounts(updatedAccounts);
    }

    try {
      localStorage.setItem('track_expenser_transactions', JSON.stringify(updated));
      localStorage.setItem('track_expenser_accounts', JSON.stringify(updatedAccounts));
      const existingCached = localStorage.getItem('track_expenser_cached_dashboard');
      if (existingCached) {
        const base = JSON.parse(existingCached);
        localStorage.setItem(
          'track_expenser_cached_dashboard',
          JSON.stringify({ ...base, transactions: updated, accounts: updatedAccounts })
        );
      }
    } catch {}

    if (isAuthenticated) {
      try {
        const response = await fetch(
          `/api/dashboard?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
        if (!response.ok) {
          const responseData = await response.json();
          console.warn('[Dashboard] Delete error on server:', responseData.error);
        }
      } catch (err) {
        console.warn('[Dashboard] Network error during delete:', err);
      }
    }
  };

  // Reset tracking cycle / history
  const handleConfirmReset = async (scope: ResetScope, resetStartingBalance: boolean) => {
    let resetOnServer = isAuthenticated;

    if (resetOnServer) {
      try {
        const res = await fetch(
          `/api/dashboard?action=${encodeURIComponent(scope)}`,
          { method: 'DELETE' }
        );
        if (res.status === 401) {
          setIsAuthenticated(false);
          setUserEmail(null);
          resetOnServer = false;
        } else if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Failed to reset on server');
        }
      } catch (err) {
        if (resetOnServer) throw err;
      }
    }

    // Update client transactions
    let remaining: DisplayTransaction[] = [];
    if (scope === 'reset_weekly') {
      remaining = transactions.filter((t) => new Date(t.occurred_at) < startOfWeek);
    } else if (scope === 'reset_monthly') {
      remaining = transactions.filter((t) => new Date(t.occurred_at) < startOfMonth);
    } else if (scope === 'reset_all') {
      remaining = [];
    }
    setTransactions(remaining);

    let updatedAccounts = accounts;
    if (resetStartingBalance) {
      setStartingBalanceRupees(0);
      try {
        localStorage.setItem('track_expenser_starting_balance', '0');
      } catch {}
      updatedAccounts = accounts.map((acc) => ({
        ...acc,
        opening_balance_paise: 0,
        current_balance_paise: 0,
      }));
      setAccounts(updatedAccounts);

      if (resetOnServer) {
        try {
          const response = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_starting_balance',
              startingBalancePaise: 0,
            }),
          });
          if (response.status === 401) {
            setIsAuthenticated(false);
            setUserEmail(null);
          }
        } catch (err) {
          console.warn('[Dashboard] Error resetting starting balance on server:', err);
        }
      }
    } else {
      updatedAccounts = accounts.map((acc) => {
        let bal = acc.opening_balance_paise;
        remaining.forEach((tx) => {
          if (tx.type === 'income' && (tx.account_id === acc.id || (!tx.account_id && acc.is_default))) bal += tx.amount_paise;
          if (tx.type === 'expense' && (tx.account_id === acc.id || (!tx.account_id && acc.is_default))) bal -= tx.amount_paise;
        });
        return { ...acc, current_balance_paise: bal };
      });
      setAccounts(updatedAccounts);
    }

    // Persist synchronously to localStorage so reloads NEVER resurrect reset history or old balances!
    try {
      localStorage.setItem('track_expenser_transactions', JSON.stringify(remaining));
      localStorage.setItem('track_expenser_accounts', JSON.stringify(updatedAccounts));
      const existingCached = localStorage.getItem('track_expenser_cached_dashboard');
      if (existingCached) {
        const base = JSON.parse(existingCached);
        localStorage.setItem(
          'track_expenser_cached_dashboard',
          JSON.stringify({
            ...base,
            transactions: remaining,
            accounts: updatedAccounts,
            ...(resetStartingBalance ? { startingBalancePaise: 0 } : {}),
          })
        );
      }
    } catch {}

    if (resetOnServer) {
      void loadDashboardData();
    }
  };

  const handleReceiptScanClick = () => {
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.click();
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const json = await response.json();
        const tx = json.transaction;
        if (tx) {
          setSharedReceiptData({
            amountRupees: tx.amount_paise ? tx.amount_paise / 100 : undefined,
            merchant: tx.merchant || undefined,
            category: tx.category || undefined,
            note: tx.note || undefined,
          });
          setNewTransactionType(tx.type === 'income' ? 'income' : 'expense');
          setIsAddModalOpen(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Receipt scan error:', err);
    } finally {
      setIsScanningReceipt(false);
      if (receiptFileInputRef.current) {
        receiptFileInputRef.current.value = '';
      }
      setIsAddModalOpen(true);
    }
  };

  const handleAddTransaction = async (data: {
    type: 'expense' | 'income' | 'transfer';
    amountRupees: number;
    accountId?: string | null;
    transferToAccountId?: string | null;
    category?: string;
    merchant?: string;
    note?: string;
    occurredAt?: string;
  }) => {
    const cat = DEFAULT_CATEGORIES.find((c) => c.name === data.category);
    const amount_paise = Math.round(data.amountRupees * 100);

    const findAccount = (accId?: string | null): DashboardAccount | undefined => {
      if (!accId) return undefined;
      const exact = accounts.find((a) => a.id === accId);
      if (exact) return exact;
      const lower = accId.toLowerCase();
      if (lower.includes('cash-vault') || (lower.includes('vault') && lower.includes('cash')) || lower === 'cash vault') {
        return accounts.find((a) => a.purpose === 'savings' && (a.type === 'cash' || a.name.toLowerCase().includes('cash')));
      }
      if (lower.includes('online-vault') || (lower.includes('vault') && lower.includes('online')) || lower.includes('savings')) {
        return accounts.find((a) => a.purpose === 'savings' && (a.type === 'bank' || a.name.toLowerCase().includes('online')));
      }
      if (lower.includes('cash')) {
        return accounts.find((a) => a.purpose === 'spending' && a.type === 'cash');
      }
      if (lower.includes('bank') || lower.includes('upi')) {
        return accounts.find((a) => a.is_default || (a.purpose === 'spending' && a.type === 'bank'));
      }
      return undefined;
    };

    const fromAcc = findAccount(data.accountId) || accounts[0];
    const toAcc = findAccount(data.transferToAccountId) || null;

    const sourceAccId = fromAcc?.id || data.accountId;
    const destAccId = toAcc?.id || data.transferToAccountId;
    const isSameAccount = data.type === 'transfer' && sourceAccId && destAccId && sourceAccId === destAccId;

    // Guard: Prevent negative money storage / insufficient balance
    if (data.type === 'expense' && fromAcc && fromAcc.current_balance_paise < amount_paise) {
      const avail = (Math.max(0, fromAcc.current_balance_paise) / 100).toFixed(2);
      const needed = data.amountRupees.toFixed(2);
      throw new Error(
        isHindi
          ? `${fromAcc.name} में अपर्याप्त बैलेंस है! उपलब्ध: ₹${avail}, आवश्यक: ₹${needed}`
          : `Insufficient balance in ${fromAcc.name}! Available: ₹${avail}, Needed: ₹${needed}`
      );
    }

    if (data.type === 'transfer' && !isSameAccount && fromAcc && fromAcc.current_balance_paise < amount_paise) {
      const avail = (Math.max(0, fromAcc.current_balance_paise) / 100).toFixed(2);
      const needed = data.amountRupees.toFixed(2);
      throw new Error(
        isHindi
          ? `${fromAcc.name} में अपर्याप्त बैलेंस है! उपलब्ध: ₹${avail}, आवश्यक: ₹${needed}`
          : `Insufficient balance in ${fromAcc.name}! Available: ₹${avail}, Needed: ₹${needed}`
      );
    }

    const newTx: DisplayTransaction = {
      id: `manual-${Date.now()}`,
      type: isSameAccount ? 'income' : data.type,
      amount_paise,
      account_id: sourceAccId,
      account_name: fromAcc?.name ?? 'Bank / UPI',
      transfer_to_account_id: isSameAccount ? null : destAccId || null,
      transfer_to_account_name: isSameAccount ? null : toAcc?.name || null,
      merchant: data.merchant || (isSameAccount ? 'Self Deposit / Top-up' : null),
      note: data.note || null,
      category_name: isSameAccount ? 'Deposit' : data.type === 'transfer' ? 'Transfer' : data.category || 'General',
      category_color: isSameAccount ? '#10B981' : data.type === 'transfer' ? '#3B82F6' : cat?.color || '#64748B',
      source: 'web',
      occurred_at: data.occurredAt ?? new Date().toISOString(),
    };

    // 1. Calculate updated transactions
    const updatedTransactions = [newTx, ...transactions];
    setTransactions(updatedTransactions);

    // 2. Optimistically update account balances in state immediately
    const updatedAccounts = accounts.map((acc) => {
      let bal = acc.current_balance_paise;
      if (data.type === 'expense' && acc.id === sourceAccId) {
        bal -= amount_paise;
      } else if (data.type === 'income' && acc.id === sourceAccId) {
        bal += amount_paise;
      } else if (data.type === 'transfer') {
        if (isSameAccount) {
          // Flexible transfer: transferring into the same account directly tops it up!
          if (acc.id === sourceAccId) {
            bal += amount_paise;
          }
        } else {
          if (acc.id === sourceAccId) {
            bal -= amount_paise;
          }
          if (acc.id === destAccId) {
            bal += amount_paise;
          }
        }
      }
      return { ...acc, current_balance_paise: bal };
    });
    setAccounts(updatedAccounts);

    // 3. Immediately persist updated transactions & accounts to local storage (both keys so reload NEVER reverts!)
    try {
      localStorage.setItem('track_expenser_transactions', JSON.stringify(updatedTransactions));
      localStorage.setItem('track_expenser_accounts', JSON.stringify(updatedAccounts));

      const existingCached = localStorage.getItem('track_expenser_cached_dashboard');
      const baseCached = existingCached ? JSON.parse(existingCached) : {};
      localStorage.setItem(
        'track_expenser_cached_dashboard',
        JSON.stringify({
          ...baseCached,
          accounts: updatedAccounts,
          transactions: updatedTransactions,
        })
      );
    } catch (err) {
      console.warn('[Dashboard] LocalStorage caching warning:', err);
    }

    // 4. Background server sync if authenticated (without jittery full dashboard refetch!)
    if (isAuthenticated) {
      try {
        const res = await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_transaction',
            type: data.type,
            amount_paise,
            account_id: sourceAccId,
            transfer_to_account_id: destAccId,
            source_account_name: fromAcc?.name,
            transfer_to_account_name: toAcc?.name,
            category_name: isSameAccount ? 'Deposit' : data.category,
            merchant: data.merchant,
            note: data.note,
            occurred_at: data.occurredAt,
          }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.transaction?.id) {
            setTransactions((prev) => {
              const updated = prev.map((t) => (t.id === newTx.id ? { ...t, id: resData.transaction.id } : t));
              try {
                localStorage.setItem('track_expenser_transactions', JSON.stringify(updated));
                const existingCached = localStorage.getItem('track_expenser_cached_dashboard');
                if (existingCached) {
                  const base = JSON.parse(existingCached);
                  localStorage.setItem(
                    'track_expenser_cached_dashboard',
                    JSON.stringify({ ...base, transactions: updated })
                  );
                }
              } catch {}
              return updated;
            });
          }
        } else {
          console.warn('[Dashboard] Server rejected transaction sync:', res.status);
        }
      } catch (err) {
        console.warn('[Dashboard] Network error during background transaction sync:', err);
      }
    }
  };

  const handleAuthSuccess = (email: string) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    setIsAddModalOpen(false);
    void loadDashboardData(true);
  };

  // Sign out (Instant 0ms UI update + clean session termination)
  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUserEmail(null);
    setTransactions([]);
    setStartingBalanceRupees(0);
    setAccounts([
      { id: 'default-bank', name: 'Bank / UPI', type: 'bank', purpose: 'spending', is_default: true, opening_balance_paise: 0, target_goal_paise: null, current_balance_paise: 0 },
      { id: 'default-cash', name: 'Cash', type: 'cash', purpose: 'spending', is_default: false, opening_balance_paise: 0, target_goal_paise: null, current_balance_paise: 0 },
      { id: 'default-online-vault', name: 'Online Vault', type: 'bank', purpose: 'savings', is_default: false, opening_balance_paise: 0, target_goal_paise: 5000000, current_balance_paise: 0 },
      { id: 'default-cash-vault', name: 'Cash Vault', type: 'cash', purpose: 'savings', is_default: false, opening_balance_paise: 0, target_goal_paise: 2000000, current_balance_paise: 0 },
    ]);

    try {
      localStorage.removeItem('track_expenser_phone');
      localStorage.removeItem('track_expenser_starting_balance');
      localStorage.removeItem('track_expenser_cached_dashboard');
      localStorage.removeItem('track_expenser_transactions');
      localStorage.removeItem('track_expenser_accounts');
    } catch {}

    void fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {});
    try {
      const client = createBrowserSupabaseClient();
      void client?.auth?.signOut();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-black dark:text-zinc-50">
      {/* Navbar with Brand Logo, Sign In / Out & Reset */}
      <Navbar
        isAuthenticated={isAuthenticated}
        userEmail={userEmail}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Hero Section: Total Balance & Quick Actions */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50/50 p-6 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {isHindi ? 'उपलब्ध कुल खर्च राशि (Available Balance)' : 'Total Available Spending Balance'}
              </span>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                  {formatINR(totalSpendingBalancePaise, { showPaise: false })}
                </h1>
                {totalSavingsBalancePaise > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span>+ {formatINR(totalSavingsBalancePaise, { showPaise: false })} {isHindi ? 'बचत (2 वॉल्ट्स)' : 'in 2 vaults'}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                  <span>💳 {isHindi ? 'ऑनलाइन (UPI):' : 'Online (UPI):'}</span>
                  <strong className="font-bold">{formatINR(onlineSpendingPaise, { showPaise: false })}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <span>💵 {isHindi ? 'नकद (जेब में):' : 'Cash (In Hand):'}</span>
                  <strong className="font-bold">{formatINR(cashSpendingPaise, { showPaise: false })}</strong>
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {isHindi
                  ? 'बैंक (UPI) और नकद का अलग-अलग व कुल जोड़। 2 सुरक्षित वॉल्ट्स के साथ।'
                  : 'Total liquid balance across your Bank (UPI) and Cash in hand, with 2 savings vaults.'}
              </p>
            </div>

            {/* 4 Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setSharedReceiptData(null);
                  setNewTransactionType('expense');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 sm:px-6"
              >
                <span>{isHindi ? '− खर्च जोड़ें' : '− Add Expense'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSharedReceiptData(null);
                  setNewTransactionType('income');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-xs transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:px-5"
              >
                <span>{isHindi ? '+ कमाई जोड़ें' : '+ Add Income'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSharedReceiptData(null);
                  setNewTransactionType('transfer');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm font-bold text-blue-800 shadow-xs transition hover:bg-blue-100 active:scale-95 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60 sm:px-5"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>{isHindi ? '⇄ ट्रांसफर / ATM' : '⇄ Transfer / ATM'}</span>
              </button>

              <button
                type="button"
                onClick={handleReceiptScanClick}
                disabled={isScanningReceipt}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 sm:px-5"
              >
                <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isScanningReceipt ? (isHindi ? 'पढ़ रहे हैं...' : 'Scanning...') : (isHindi ? '📷 रसीद स्कैन' : '📷 Scan Receipt')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Account Cards: Bank, Cash (with Reconcile), and Savings */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'आपके खाते' : 'Your Accounts'}
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isHindi ? 'पैसों की सही जगह' : 'Where your money lives'}
            </span>
          </div>

          <AccountCards
            accounts={accounts}
            onReconcile={handleReconcileAccount}
            onOpenTransferModal={() => {
              setNewTransactionType('transfer');
              setIsAddModalOpen(true);
            }}
            language={language}
          />
        </section>

        {/* Period Selector & Summary Stats */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 sm:inline">
                {isHindi ? 'समय:' : 'Period:'}
              </span>
              <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800 sm:flex sm:w-auto sm:gap-0">
                <button
                  type="button"
                  onClick={() => handleCycleChange('weekly')}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    timeRange === 'weekly'
                      ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>{isHindi ? 'सप्ताह' : 'This Week'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('monthly')}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    timeRange === 'monthly'
                      ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Calendar className="h-3 w-3 text-emerald-500" />
                  <span>{isHindi ? 'महीना' : 'This Month'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('all')}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    timeRange === 'all'
                      ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Layers className="h-3 w-3 text-cyan-500" />
                  <span>{isHindi ? 'सभी' : 'All Time'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {cycleRangeLabel}
              </span>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-rose-400"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
              </button>
            </div>
          </div>

          {/* 4 Clean Snapshot Cards: Savings (2 Vaults), Income (Online & Cash), Spent (Online & Cash), and Spent Today */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Total Savings (2 Vaults) */}
            <div className="flex flex-col justify-between rounded-3xl border border-indigo-100 bg-white p-5 shadow-xs dark:border-indigo-950/50 dark:bg-zinc-900">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  <span>{isHindi ? 'कुल बचत (2 वॉल्ट्स)' : 'Total Savings (2 Vaults)'}</span>
                  <Coins className="h-4 w-4" />
                </div>
                <p className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {formatINR(totalSavingsBalancePaise, { showPaise: false })}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-[11px] dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  🏦 {isHindi ? 'ऑनलाइन:' : 'Online:'} {formatINR(onlineSavingsPaise, { showPaise: false })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <WalletCards className="h-3 w-3" />
                  {isHindi ? 'नकद बचत:' : 'Cash savings:'} {formatINR(cashSavingsPaise, { showPaise: false })}
                </span>
              </div>
            </div>

            {/* Card 2: Total Income (Online & Cash) */}
            <div className="flex flex-col justify-between rounded-3xl border border-emerald-100 bg-white p-5 shadow-xs dark:border-emerald-950/50 dark:bg-zinc-900">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <span>{isHindi ? 'कुल कमाई' : 'Total Income'}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatINR(cycleIncomePaise, { showPaise: false })}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-[11px] dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  💳 {isHindi ? 'ऑनलाइन:' : 'Online:'} {formatINR(cycleOnlineIncomePaise, { showPaise: false })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  💵 {isHindi ? 'नकद:' : 'Cash:'} {formatINR(cycleCashIncomePaise, { showPaise: false })}
                </span>
              </div>
            </div>

            {/* Card 3: Total Spent (Online & Cash) */}
            <div className="flex flex-col justify-between rounded-3xl border border-rose-100 bg-white p-5 shadow-xs dark:border-rose-950/50 dark:bg-zinc-900">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  <span>{isHindi ? 'कुल खर्च' : 'Total Spent'}</span>
                  <ArrowDownRight className="h-4 w-4" />
                </div>
                <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
                  {formatINR(cycleSpentPaise, { showPaise: false })}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-[11px] dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  💳 {isHindi ? 'ऑनलाइन:' : 'Online:'} {formatINR(cycleOnlineSpentPaise, { showPaise: false })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  💵 {isHindi ? 'नकद:' : 'Cash:'} {formatINR(cycleCashSpentPaise, { showPaise: false })}
                </span>
              </div>
            </div>

            {/* Card 4: Spent Today */}
            <div className="flex flex-col justify-between rounded-3xl border border-blue-100 bg-white p-5 shadow-xs dark:border-blue-950/50 dark:bg-zinc-900">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  <span>{isHindi ? 'आज का खर्च' : 'Spent Today'}</span>
                  <span className="text-[11px] font-semibold text-zinc-400">{todayTransactions.length} {isHindi ? 'खर्च' : 'records'}</span>
                </div>
                <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  {formatINR(todaySpendPaise, { showPaise: false })}
                </p>
              </div>
              <div className="mt-3 border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {isHindi ? 'आज का कुल खर्च' : 'Money spent today'}
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Grid: Transactions on Left, Category Breakdown & Tips on Right */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Transaction Feed (2/3 width) */}
          <div className="space-y-6 lg:col-span-2">
            <TransactionFeed
              transactions={cycleTransactions}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddModal={() => {
                setNewTransactionType('expense');
                setIsAddModalOpen(true);
              }}
              onOpenResetModal={() => setIsResetModalOpen(true)}
              startingBalanceRupees={startingBalanceRupees}
              language={language}
            />
          </div>

          {/* Right Column: Category Breakdown & How It Works (1/3 width) */}
          <div className="space-y-6 lg:col-span-1">
            <CategoryBreakdown
              categories={categoryItems}
              totalSpendPaise={cycleSpentPaise}
              language={language}
            />

            {/* How It Works Guide Card */}
            <div className="rounded-3xl border border-zinc-200 bg-linear-to-b from-zinc-50/80 to-white p-5 shadow-xs dark:border-zinc-800 dark:from-zinc-900/60 dark:to-zinc-900">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isHindi ? 'आसान गाइड (कैसे इस्तेमाल करें)' : 'Simple Guide: How It Works'}
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    1
                  </span>
                  <p>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {isHindi ? 'ऑनलाइन भुगतान (GPay / PhonePe):' : 'Online / UPI Payment:'}
                    </strong>{' '}
                    {isHindi
                      ? 'खर्च जोड़ते समय Bank / UPI खाता चुनें।'
                      : 'Choose Bank / UPI account when adding the expense.'}
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    2
                  </span>
                  <p>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {isHindi ? 'नकद खर्च (चाय, ऑटो, सब्जी):' : 'Cash Expense (Chai, Auto, Cash):'}
                    </strong>{' '}
                    {isHindi ? 'खर्च जोड़ते समय Cash खाता चुनें।' : 'Choose Cash account when spending cash.'}
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    3
                  </span>
                  <p>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {isHindi ? 'ATM निकासी (ATM Withdrawal):' : 'ATM Cash Withdrawal:'}
                    </strong>{' '}
                    {isHindi
                      ? '⇄ ट्रांसफर बटन दबाएं और Bank से Cash में पैसे ट्रांसफर करें।'
                      : 'Click ⇄ Transfer to move money from Bank to Cash (not an expense!).'}
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    4
                  </span>
                  <p>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {isHindi ? 'जेब का नकद मिलाना (Adjust Cash):' : 'Sync Real Cash:'}
                    </strong>{' '}
                    {isHindi
                      ? 'Cash कार्ड पर "गिनती से मिलाएं" दबाएं और जेब का असली नकद दर्ज करें।'
                      : 'Click "Count & Match" on Cash card whenever your physical cash differs.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Floating Action Button (FAB) for quick access anywhere */}
        <div className="fixed bottom-6 right-5 z-30 sm:hidden">
          <button
            type="button"
            onClick={() => {
              setNewTransactionType('expense');
              setIsAddModalOpen(true);
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl shadow-emerald-600/50 transition hover:bg-emerald-500 active:scale-90"
            aria-label={isHindi ? 'नया खर्च दर्ज करें' : 'Add new transaction'}
          >
            <span className="text-2xl font-black leading-none">+</span>
          </button>
        </div>
      </main>

      {/* Sign In / Switch Account Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        currentUserEmail={userEmail}
        language={language}
      />

      {/* Reset Cycle Modal */}
      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        currentScope={timeRange}
        onConfirmReset={handleConfirmReset}
        language={language}
      />

      {/* Hidden file input for direct receipt / UPI screenshot scanning */}
      <input
        type="file"
        ref={receiptFileInputRef}
        onChange={handleReceiptFileChange}
        accept="image/*"
        className="hidden"
        aria-hidden="true"
      />

      {/* Manual Add Transaction / Transfer Modal */}
      <AddTransactionModal
        key={`${newTransactionType}-${accounts.length}-${sharedReceiptData ? 'shared' : 'normal'}`}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSharedReceiptData(null);
        }}
        initialType={newTransactionType}
        initialAmount={sharedReceiptData?.amountRupees ? String(sharedReceiptData.amountRupees) : undefined}
        initialMerchant={sharedReceiptData?.merchant}
        initialCategory={sharedReceiptData?.category}
        initialNote={sharedReceiptData?.note}
        accounts={accounts}
        isAuthenticated={isAuthenticated}
        onSubmit={handleAddTransaction}
        language={language}
      />
    </div>
  );
}
