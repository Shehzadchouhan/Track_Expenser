'use client';

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { Navbar } from '@/components/Navbar';
import { TotalBalanceCard } from '@/components/TotalBalanceCard';
import { SpendingTrendChart } from '@/components/SpendingTrendChart';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { WhatsAppLinkCard } from '@/components/WhatsAppLinkCard';
import { TransactionFeed, DisplayTransaction } from '@/components/TransactionFeed';
import { CategoryBreakdown, CategorySpendItem } from '@/components/CategoryBreakdown';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { ResetModal, ResetScope } from '@/components/ResetModal';
import { AuthModal } from '@/components/AuthModal';
import { calculateDailyBudgetPulse, BudgetPulseResult } from '@/lib/budget';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { formatINR } from '@/lib/money';
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
} from 'lucide-react';

function isDisplayTransaction(value: unknown): value is DisplayTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const transaction = value as Record<string, unknown>;
  return (
    typeof transaction.id === 'string' &&
    (transaction.type === 'income' || transaction.type === 'expense') &&
    typeof transaction.amount_paise === 'number' &&
    Number.isFinite(transaction.amount_paise) &&
    typeof transaction.source === 'string' &&
    ['web', 'whatsapp_text', 'whatsapp_image'].includes(transaction.source) &&
    typeof transaction.occurred_at === 'string'
  );
}

export default function Home() {
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [startingBalanceRupees, setStartingBalanceRupees] = useState<number>(50000); // Default Starting Capital ₹50,000
  const [monthlyBudgetPaise, setMonthlyBudgetPaise] = useState<number>(2500000); // Default ₹25,000
  const [isPhoneLinked, setIsPhoneLinked] = useState<boolean>(false);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [isSimpleView, setIsSimpleView] = useState(true);
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
  const [newTransactionType, setNewTransactionType] = useState<'expense' | 'income'>('expense');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Fetch live dashboard data from Supabase if phone is linked
  const loadDashboardData = useCallback(async (phone: string) => {
    if (!phone) return;
    try {
      const res = await fetch(`/api/dashboard?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.linked) {
        setIsPhoneLinked(true);
        setLinkedPhone(data.phone);
        if (data.monthlyBudgetPaise) {
          setMonthlyBudgetPaise(data.monthlyBudgetPaise);
        }
        // Always set transactions when data.transactions is returned (even if empty [])
        if (Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Error refreshing live data:', err);
    }
  }, []);

  // Restore stored phone link, starting balance, and cycle on initial mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('track_expenser_phone') || '';
    const savedStartingBalance = localStorage.getItem('track_expenser_starting_balance');
    const savedCycle = localStorage.getItem('track_expenser_cycle') as 'weekly' | 'monthly' | 'all' | null;

    if (savedStartingBalance) {
      const parsed = parseFloat(savedStartingBalance);
      if (!isNaN(parsed) && parsed >= 0) {
        setStartingBalanceRupees(parsed);
      }
    }

    if (savedCycle && ['weekly', 'monthly', 'all'].includes(savedCycle)) {
      setTimeRange(savedCycle);
    }

    if (savedPhone) {
      setLinkedPhone(savedPhone);
      loadDashboardData(savedPhone);
    } else {
      const savedTransactions = localStorage.getItem('track_expenser_transactions');
      if (savedTransactions) {
        try {
          const parsedTransactions: unknown = JSON.parse(savedTransactions);
          if (Array.isArray(parsedTransactions) && parsedTransactions.every(isDisplayTransaction)) {
            setTransactions(parsedTransactions);
          } else {
            console.warn('[Dashboard] Saved local transactions are not a list.');
          }
        } catch (err) {
          console.warn('[Dashboard] Could not restore saved local transactions:', err);
        }
      }
    }
  }, [loadDashboardData]);

  // Periodic polling for new WhatsApp expenses (5s live pulse)
  useEffect(() => {
    if (!linkedPhone) return;
    const interval = setInterval(() => {
      loadDashboardData(linkedPhone);
    }, 5000);
    return () => clearInterval(interval);
  }, [linkedPhone, loadDashboardData]);

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

  // Compute spend stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const spentTodayPaise = cycleTransactions
    .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= todayStart)
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const cycleSpentPaise = cycleTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);
  const monthSpentPaise = transactions
    .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= startOfMonth)
    .reduce((sum, t) => sum + t.amount_paise, 0);
  const todayTransactions = transactions.filter(
    (t) => t.type === 'expense' && new Date(t.occurred_at) >= todayStart
  );
  const todaySpendPaise = todayTransactions.reduce((sum, t) => sum + t.amount_paise, 0);

  const pulse: BudgetPulseResult = calculateDailyBudgetPulse({
    monthlyBudgetPaise,
    monthSpentPaise: cycleSpentPaise,
    spentTodayPaise,
  });

  // Calculate Category Breakdown based on cycle transactions
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
    setMonthlyBudgetPaise(paise);

    if (linkedPhone) {
      try {
        await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: linkedPhone,
            action: 'update_budget',
            monthlyBudgetPaise: paise,
          }),
        });
      } catch (err) {
        console.warn('Failed to persist budget update:', err);
      }
    }
  };

  const handleUpdateStartingBalance = (newBalance: number) => {
    setStartingBalanceRupees(newBalance);
    localStorage.setItem('track_expenser_starting_balance', newBalance.toString());
  };

  // Permanently delete transaction from Supabase and UI
  const handleDeleteTransaction = async (id: string) => {
    if (linkedPhone) {
      const response = await fetch(
        `/api/dashboard?id=${encodeURIComponent(id)}&phone=${encodeURIComponent(linkedPhone)}`,
        { method: 'DELETE' }
      );
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Could not delete this record. Please try again.');
      }
    } else {
      const savedTransactions = transactions.filter((transaction) => transaction.id !== id);
      localStorage.setItem('track_expenser_transactions', JSON.stringify(savedTransactions));
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Reset tracking cycle / history
  const handleConfirmReset = async (scope: ResetScope, resetStartingBalance: boolean) => {
    if (linkedPhone) {
      const res = await fetch(
        `/api/dashboard?action=${encodeURIComponent(scope)}&phone=${encodeURIComponent(linkedPhone)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || 'Failed to reset on server');
      }
    }

    // Update client transactions
    if (scope === 'reset_weekly') {
      const remaining = transactions.filter((t) => new Date(t.occurred_at) < startOfWeek);
      setTransactions(remaining);
      if (!linkedPhone) localStorage.setItem('track_expenser_transactions', JSON.stringify(remaining));
    } else if (scope === 'reset_monthly') {
      const remaining = transactions.filter((t) => new Date(t.occurred_at) < startOfMonth);
      setTransactions(remaining);
      if (!linkedPhone) localStorage.setItem('track_expenser_transactions', JSON.stringify(remaining));
    } else if (scope === 'reset_all') {
      setTransactions([]);
      if (!linkedPhone) localStorage.setItem('track_expenser_transactions', JSON.stringify([]));
    }

    if (resetStartingBalance) {
      setStartingBalanceRupees(0);
      localStorage.setItem('track_expenser_starting_balance', '0');
    }
  };

  const handleAddTransaction = async (data: {
    type: 'expense' | 'income';
    amountRupees: number;
    category: string;
    merchant?: string;
    note?: string;
  }) => {
    const cat = DEFAULT_CATEGORIES.find((c) => c.name === data.category);
    const amount_paise = Math.round(data.amountRupees * 100);
    const newTx: DisplayTransaction = {
      id: `manual-${Date.now()}`,
      type: data.type,
      amount_paise,
      merchant: data.merchant || null,
      note: data.note || null,
      category_name: data.category,
      category_color: cat?.color || '#64748B',
      source: 'web',
      occurred_at: new Date().toISOString(),
    };

    if (linkedPhone) {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: linkedPhone,
          action: 'add_transaction',
          type: data.type,
          amount_paise,
          category_name: data.category,
          merchant: data.merchant,
          note: data.note,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.transaction?.id) {
        throw new Error(resData.error || 'Could not save your record. Please try again.');
      }
      newTx.id = resData.transaction.id;
    } else {
      const savedTransactions = localStorage.getItem('track_expenser_transactions');
      let parsedTransactions: unknown = [];
      if (savedTransactions) {
        try {
          parsedTransactions = JSON.parse(savedTransactions);
        } catch {
          throw new Error('Could not read your saved records. Please keep this browser data and try again.');
        }
      }
      if (!Array.isArray(parsedTransactions) || !parsedTransactions.every(isDisplayTransaction)) {
        throw new Error('Could not read your saved records. Please keep this browser data and try again.');
      }
      localStorage.setItem(
        'track_expenser_transactions',
        JSON.stringify([newTx, ...parsedTransactions])
      );
    }

    setTransactions((prev) => [newTx, ...prev]);
  };

  const handlePhoneLinkedSuccess = (phone: string) => {
    setIsPhoneLinked(true);
    setLinkedPhone(phone);
    setIsAuthModalOpen(false);
    localStorage.setItem('track_expenser_phone', phone);
    loadDashboardData(phone);
  };

  // Sign out / switch account
  const handleSignOut = () => {
    localStorage.removeItem('track_expenser_phone');
    localStorage.removeItem('track_expenser_starting_balance');
    setIsPhoneLinked(false);
    setLinkedPhone(null);
    setTransactions([]);
    setStartingBalanceRupees(0);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-black dark:text-zinc-50">
      {/* Navbar with Brand Logo, WhatsApp Link, Sign In / Out & Reset */}
      <Navbar
        isPhoneLinked={isPhoneLinked}
        phoneNumber={linkedPhone}
        onOpenPhoneModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {isSimpleView && (
          <section className="mx-auto max-w-3xl space-y-5">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {isHindi ? 'आपका पैसा, आसानी से' : 'Your money, made simple'}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                {isHindi
                  ? isPhoneLinked ? 'आपके पैसों का आसान हिसाब' : 'पैसों का हिसाब शुरू करें'
                  : isPhoneLinked ? 'Your money at a glance' : 'Start keeping a money record'}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                {isHindi
                  ? 'खर्च या कमाई जोड़ें। WhatsApp पर रकम लिखें या भुगतान का स्क्रीनशॉट भेजें।'
                  : 'Add money you spend or receive. You can also send a payment screenshot on WhatsApp.'}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/30">
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    {isHindi ? 'इस महीने का खर्च' : 'Spent this month'}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatINR(monthSpentPaise, { showPaise: false })}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-800">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {isHindi ? 'आज का खर्च' : 'Spent today'}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatINR(todaySpendPaise, { showPaise: false })}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {isHindi
                      ? `${todayTransactions.length} खर्च आज`
                      : `${todayTransactions.length} expenses today`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setNewTransactionType('expense');
                    setIsAddModalOpen(true);
                  }}
                  className="min-h-14 rounded-2xl bg-emerald-600 px-5 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  {isHindi ? '+ खर्च जोड़ें' : '+ Add expense'}
                </button>
                <button
                  onClick={() => {
                    setNewTransactionType('income');
                    setIsAddModalOpen(true);
                  }}
                  className="min-h-14 rounded-2xl border-2 border-emerald-700 px-5 text-lg font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  {isHindi ? '+ कमाई जोड़ें' : '+ Add income'}
                </button>
              </div>
            </div>

            <TransactionFeed
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddModal={() => {
                setNewTransactionType('expense');
                setIsAddModalOpen(true);
              }}
              simpleMode
              language={language}
              onShowAllTransactions={() => setIsSimpleView(false)}
            />

            <button
              onClick={() => setIsSimpleView(false)}
              className="min-h-12 w-full rounded-xl text-sm font-semibold text-zinc-500 underline underline-offset-4 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              {isHindi ? 'पैसों की और जानकारी' : 'More money details'}
            </button>
          </section>
        )}

        {/* Cycle Tracking & Reset Toolbar */}
        {!isSimpleView && <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 sm:flex-row sm:items-center sm:justify-between">
          {/* Cycle Selector Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {isHindi ? 'समय:' : 'Time:'}
            </span>
            <div className="flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
              <button
                onClick={() => handleCycleChange('weekly')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  timeRange === 'weekly'
                    ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Zap className="h-3 w-3 text-amber-500" />
                <span>{isHindi ? 'इस सप्ताह' : 'This Week'}</span>
              </button>
              <button
                onClick={() => handleCycleChange('monthly')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  timeRange === 'monthly'
                    ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Calendar className="h-3 w-3 text-emerald-500" />
                <span>{isHindi ? 'इस महीने' : 'This Month'}</span>
              </button>
              <button
                onClick={() => handleCycleChange('all')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  timeRange === 'all'
                    ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Layers className="h-3 w-3 text-cyan-500" />
                <span>{isHindi ? 'पूरा हिसाब' : 'All Time'}</span>
              </button>
            </div>
          </div>

          {/* Active Range & Reset Action */}
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400" suppressHydrationWarning>
              {isHindi
                ? timeRange === 'weekly'
                  ? 'इस सप्ताह'
                  : timeRange === 'monthly'
                    ? new Date().toLocaleDateString('hi-IN', { month: 'long', year: 'numeric' })
                    : 'पूरा हिसाब'
                : cycleRangeLabel}
            </span>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
              title={isHindi ? 'लेन-देन का हिसाब साफ़ करें' : 'Reset cycle or transaction history'}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isHindi ? 'हिसाब रीसेट करें' : 'Reset cycle'}</span>
            </button>
          </div>
          <button
            onClick={() => setIsSimpleView(true)}
            className="min-h-10 rounded-xl px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isHindi ? 'आसान होम' : 'Simple home'}
          </button>
        </div>}

        {/* Dashboard Grid */}
        {!isSimpleView && <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left / Main Column: Balances, Visual Analytics & Transactions */}
          <div className="space-y-8 lg:col-span-2">
            {/* Live Total Balance & Fluctuation Cockpit */}
            <TotalBalanceCard
              transactions={cycleTransactions}
              startingBalanceRupees={startingBalanceRupees}
              onUpdateStartingBalance={handleUpdateStartingBalance}
              language={language}
            />

            {/* Dual Analytics Row: Safe to Spend Pace & 7-Day Activity Chart */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SafeToSpendCard pulse={pulse} onUpdateBudget={handleUpdateBudget} language={language} />
              <SpendingTrendChart
                transactions={cycleTransactions}
                dailyAllowancePaise={pulse.dailySafeAllowancePaise}
                language={language}
              />
            </div>

            {/* Transactions Feed & Statement Actions */}
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

          {/* Right Column: WhatsApp Linker & Category Breakdown */}
          <div className="space-y-8 lg:col-span-1">
            {/* WhatsApp Integration Widget */}
            <WhatsAppLinkCard
              isLinked={isPhoneLinked}
              linkedPhone={linkedPhone}
              onSuccess={handlePhoneLinkedSuccess}
              language={language}
            />

            {/* Category Breakdown */}
            <CategoryBreakdown
              categories={categoryItems}
              totalSpendPaise={cycleSpentPaise}
              language={language}
            />
          </div>
        </div>}
      </main>

      {/* Sign In / Switch Account Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handlePhoneLinkedSuccess}
        currentPhone={linkedPhone}
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

      {/* Manual Add Transaction Modal */}
      <AddTransactionModal
        key={newTransactionType}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialType={newTransactionType}
        onSubmit={handleAddTransaction}
        language={language}
      />
    </div>
  );
}
