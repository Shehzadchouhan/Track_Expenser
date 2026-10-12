'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { TotalBalanceCard } from '@/components/TotalBalanceCard';
import { SpendingTrendChart } from '@/components/SpendingTrendChart';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { WhatsAppLinkCard } from '@/components/WhatsAppLinkCard';
import { TransactionFeed, DisplayTransaction } from '@/components/TransactionFeed';
import { CategoryBreakdown, CategorySpendItem } from '@/components/CategoryBreakdown';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { calculateDailyBudgetPulse, BudgetPulseResult } from '@/lib/budget';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { X } from 'lucide-react';

const INITIAL_DEMO_TRANSACTIONS: DisplayTransaction[] = [
  {
    id: 'demo-1',
    type: 'expense',
    amount_paise: 35000,
    merchant: 'HPCL Petrol Pump',
    note: 'petrol refill',
    category_name: 'Transportation',
    category_color: '#3B82F6',
    source: 'whatsapp_text',
    occurred_at: '2026-10-11T04:00:00.000Z',
  },
  {
    id: 'demo-2',
    type: 'expense',
    amount_paise: 24000,
    merchant: 'Swiggy',
    note: 'lunch delivery',
    category_name: 'Food & Dining',
    category_color: '#F59E0B',
    source: 'whatsapp_image',
    occurred_at: '2026-10-11T03:00:00.000Z',
  },
  {
    id: 'demo-3',
    type: 'income',
    amount_paise: 1500000,
    merchant: 'Client Payment',
    note: 'UI design gig',
    category_name: 'Freelance',
    category_color: '#06B6D4',
    source: 'web',
    occurred_at: '2026-10-10T05:30:00.000Z',
  },
];

export default function Home() {
  const [transactions, setTransactions] = useState<DisplayTransaction[]>(INITIAL_DEMO_TRANSACTIONS);
  const [startingBalanceRupees, setStartingBalanceRupees] = useState<number>(50000); // Default Starting Capital ₹50,000
  const [monthlyBudgetPaise, setMonthlyBudgetPaise] = useState<number>(2500000); // Default ₹25,000
  const [isPhoneLinked, setIsPhoneLinked] = useState<boolean>(false);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  // Fetch live dashboard data from Supabase if phone is linked
  const loadDashboardData = useCallback(async (phone: string) => {
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
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          setTransactions(data.transactions);
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Error refreshing live data:', err);
    }
  }, []);

  // Restore stored phone link and starting balance on initial mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('track_expenser_phone') || '';
    const savedStartingBalance = localStorage.getItem('track_expenser_starting_balance');
    if (savedStartingBalance) {
      const parsed = parseFloat(savedStartingBalance);
      if (!isNaN(parsed) && parsed >= 0) {
        setStartingBalanceRupees(parsed);
      }
    }
    loadDashboardData(savedPhone);
  }, [loadDashboardData]);

  // Periodic polling for new WhatsApp expenses (5s live pulse)
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData(linkedPhone || '');
    }, 5000);
    return () => clearInterval(interval);
  }, [linkedPhone, loadDashboardData]);

  // Compute total spent today and month
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const spentTodayPaise = transactions
    .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= todayStart)
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const monthSpentPaise = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const pulse: BudgetPulseResult = calculateDailyBudgetPulse({
    monthlyBudgetPaise,
    monthSpentPaise,
    spentTodayPaise,
  });

  // Calculate Category Breakdown
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

  transactions
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

  const handleDeleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
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

    setTransactions((prev) => [newTx, ...prev]);

    if (linkedPhone) {
      try {
        await fetch('/api/dashboard', {
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
      } catch (err) {
        console.warn('Failed to save manual transaction:', err);
      }
    }
  };

  const handlePhoneLinkedSuccess = (phone: string) => {
    setIsPhoneLinked(true);
    setLinkedPhone(phone);
    setIsPhoneModalOpen(false);
    localStorage.setItem('track_expenser_phone', phone);
    loadDashboardData(phone);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-black dark:text-zinc-50">
      {/* Navbar with Brand Logo & One-Tap WhatsApp */}
      <Navbar
        isPhoneLinked={isPhoneLinked}
        phoneNumber={linkedPhone}
        onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left / Main Column: Balances, Visual Analytics & Transactions */}
          <div className="space-y-8 lg:col-span-2">
            {/* Live Total Balance & Fluctuation Cockpit */}
            <TotalBalanceCard
              transactions={transactions}
              startingBalanceRupees={startingBalanceRupees}
              onUpdateStartingBalance={handleUpdateStartingBalance}
            />

            {/* Dual Analytics Row: Safe to Spend Pace & 7-Day Activity Chart */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SafeToSpendCard pulse={pulse} onUpdateBudget={handleUpdateBudget} />
              <SpendingTrendChart
                transactions={transactions}
                dailyAllowancePaise={pulse.dailySafeAllowancePaise}
              />
            </div>

            {/* Transactions Feed & Statement Actions */}
            <TransactionFeed
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              startingBalanceRupees={startingBalanceRupees}
            />
          </div>

          {/* Right Column: WhatsApp Linker & Category Breakdown */}
          <div className="space-y-8 lg:col-span-1">
            {/* WhatsApp Integration Widget */}
            <WhatsAppLinkCard
              isLinked={isPhoneLinked}
              linkedPhone={linkedPhone}
              onSuccess={handlePhoneLinkedSuccess}
            />

            {/* Category Breakdown */}
            <CategoryBreakdown
              categories={categoryItems}
              totalSpendPaise={monthSpentPaise}
            />
          </div>
        </div>
      </main>

      {/* Connect WhatsApp Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setIsPhoneModalOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <X className="h-4 w-4" />
            </button>
            <WhatsAppLinkCard
              isLinked={isPhoneLinked}
              linkedPhone={linkedPhone}
              onSuccess={handlePhoneLinkedSuccess}
            />
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddTransaction}
      />
    </div>
  );
}
