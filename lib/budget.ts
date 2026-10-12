import { APP_TIMEZONE } from './constants';

export interface BudgetPulseInput {
  monthlyBudgetPaise: number | null | undefined;
  monthSpentPaise: number;
  spentTodayPaise: number;
  now?: Date;
  timezone?: string;
}

export interface BudgetPulseResult {
  monthlyBudgetPaise: number;
  monthSpentPaise: number;
  monthRemainingPaise: number;
  spentTodayPaise: number;
  dailySafeAllowancePaise: number;
  remainingTodayPaise: number;
  daysRemainingInMonth: number;
  isOverBudget: boolean;
}

/**
 * Calculates timezone-aware daily budget allowance ("Safe to Spend Today").
 *
 * Rules:
 * 1. Counts "today" in remaining days: DaysLeft = TotalDaysInMonth - CurrentDay + 1.
 * 2. Clamps cleanly to 0 paise if budget is blown or exceeded (never negative).
 * 3. Uses integer paise math throughout.
 */
export function calculateDailyBudgetPulse({
  monthlyBudgetPaise,
  monthSpentPaise,
  spentTodayPaise,
  now = new Date(),
  timezone = APP_TIMEZONE,
}: BudgetPulseInput): BudgetPulseResult {
  const budget = monthlyBudgetPaise && monthlyBudgetPaise > 0 ? monthlyBudgetPaise : 0;
  const spentThisMonth = Math.max(0, Math.round(monthSpentPaise));
  const spentToday = Math.max(0, Math.round(spentTodayPaise));

  // Determine date parts in the given timezone (e.g. Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10); // 1-indexed (1-12)
  const currentDay = parseInt(partMap.day, 10); // 1-31

  // Days in month: day 0 of next month gives last day of current month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Counting today: e.g. on 10th of 31-day month: 31 - 10 + 1 = 22 days remaining
  const daysRemainingInMonth = Math.max(1, daysInMonth - currentDay + 1);

  const monthRemainingPaise = Math.max(0, budget - spentThisMonth);
  const isOverBudget = budget > 0 && spentThisMonth > budget;

  // Safe daily allowance
  const dailySafeAllowancePaise =
    budget > 0 && daysRemainingInMonth > 0
      ? Math.floor(monthRemainingPaise / daysRemainingInMonth)
      : 0;

  // Remaining allowance for today
  const remainingTodayPaise = Math.max(0, dailySafeAllowancePaise - spentToday);

  return {
    monthlyBudgetPaise: budget,
    monthSpentPaise: spentThisMonth,
    monthRemainingPaise,
    spentTodayPaise: spentToday,
    dailySafeAllowancePaise,
    remainingTodayPaise,
    daysRemainingInMonth,
    isOverBudget,
  };
}
