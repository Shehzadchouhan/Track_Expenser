import { describe, it, expect } from 'vitest';
import { calculateDailyBudgetPulse } from '@/lib/budget';

describe('Budget Pacing & Safe-to-Spend Math', () => {
  it('counts today in the remaining days of the month', () => {
    // 10th of October 2026 (31-day month). Days left should be 31 - 10 + 1 = 22 days.
    const date = new Date(Date.UTC(2026, 9, 10, 5, 0, 0)); // Oct 10 2026
    const pulse = calculateDailyBudgetPulse({
      monthlyBudgetPaise: 2200000, // ₹22,000
      monthSpentPaise: 0,
      spentTodayPaise: 0,
      now: date,
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.daysRemainingInMonth).toBe(22);
    // ₹22,000 / 22 days = ₹1,000/day (100,000 paise)
    expect(pulse.dailySafeAllowancePaise).toBe(100000);
    expect(pulse.remainingTodayPaise).toBe(100000);
    expect(pulse.isOverBudget).toBe(false);
  });

  it('subtracts today spending from daily allowance and clamps to zero', () => {
    const date = new Date(Date.UTC(2026, 9, 10, 5, 0, 0));
    const pulse = calculateDailyBudgetPulse({
      monthlyBudgetPaise: 2200000, // ₹22,000 total, ₹1,000/day
      monthSpentPaise: 80000,      // Spent ₹800 this month (all today)
      spentTodayPaise: 80000,      // Spent ₹800 today
      now: date,
      timezone: 'Asia/Kolkata',
    });

    // Month remaining: 2,200,000 - 80,000 = 2,120,000 paise
    // Daily safe allowance: 2,120,000 / 22 = 96,363 paise (₹963.63)
    expect(pulse.dailySafeAllowancePaise).toBe(96363);
    // Remaining today: 96,363 - 80,000 = 16,363 paise
    expect(pulse.remainingTodayPaise).toBe(16363);
  });

  it('clamps remaining today to 0 when today spending exceeds allowance', () => {
    const date = new Date(Date.UTC(2026, 9, 10, 5, 0, 0));
    const pulse = calculateDailyBudgetPulse({
      monthlyBudgetPaise: 2200000, // ₹22,000
      monthSpentPaise: 200000,     // Spent ₹2,000 today
      spentTodayPaise: 200000,
      now: date,
      timezone: 'Asia/Kolkata',
    });

    // Even though spentToday > daily allowance, remaining today must be 0 (never negative)
    expect(pulse.remainingTodayPaise).toBe(0);
    expect(pulse.isOverBudget).toBe(false);
  });

  it('clamps all allowances to 0 and flags isOverBudget when monthly budget is blown', () => {
    const date = new Date(Date.UTC(2026, 9, 10, 5, 0, 0));
    const pulse = calculateDailyBudgetPulse({
      monthlyBudgetPaise: 1000000, // ₹10,000 budget
      monthSpentPaise: 1500000,    // Spent ₹15,000 (blown by ₹5,000)
      spentTodayPaise: 50000,
      now: date,
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.monthRemainingPaise).toBe(0);
    expect(pulse.dailySafeAllowancePaise).toBe(0);
    expect(pulse.remainingTodayPaise).toBe(0);
    expect(pulse.isOverBudget).toBe(true);
  });

  it('handles last day of the month correctly (days remaining = 1)', () => {
    // 31st of October 2026
    const date = new Date(Date.UTC(2026, 9, 31, 5, 0, 0));
    const pulse = calculateDailyBudgetPulse({
      monthlyBudgetPaise: 3100000, // ₹31,000
      monthSpentPaise: 3000000,    // ₹30,000 spent, ₹1,000 remaining
      spentTodayPaise: 0,
      now: date,
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.daysRemainingInMonth).toBe(1);
    expect(pulse.monthRemainingPaise).toBe(100000);
    expect(pulse.dailySafeAllowancePaise).toBe(100000);
    expect(pulse.remainingTodayPaise).toBe(100000);
  });
});
