import { MAX_PAISE } from './constants';

export interface FormatOptions {
  showPaise?: boolean;
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
}

/**
 * Converts a rupee input (number or textual string) into integer paise.
 *
 * Contract:
 * - String input is strict: allows at most 2 decimal places and throws an error
 *   if more than 2 decimal places are provided or if the format is invalid. Comma
 *   separators and currency symbols (₹, Rs, INR, $) are cleanly stripped.
 * - Number input is rounded to the nearest paise (via Math.round(val * 100))
 *   to tolerate floating-point arithmetic artifacts (e.g. 0.1 + 0.2 = 30 paise,
 *   or 1.005 = 100 paise due to IEEE-754 representation).
 *
 * Both input types must represent non-negative amounts and must not exceed MAX_PAISE (10,000,000,000 paise).
 *
 * @param val - The amount in Rupees (number or formatted string).
 * @returns The amount in integer paise as a safe-integer number.
 * @throws If string has >2 decimals, value is negative, exceeds MAX_PAISE, or is non-finite.
 */
export function toPaise(val: number | string): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val)) {
      throw new Error('Invalid numeric amount');
    }
    if (val < 0) {
      throw new Error('Amount cannot be negative');
    }
    const paise = Math.round(val * 100);
    if (!Number.isSafeInteger(paise)) {
      throw new Error('Amount exceeds safe integer range');
    }
    if (paise > MAX_PAISE) {
      throw new Error(`Amount exceeds maximum limit of ${MAX_PAISE} paise`);
    }
    return paise;
  }

  if (typeof val === 'string') {
    let s = val.trim();
    if (s === '') {
      throw new Error('Amount string cannot be empty');
    }

    // Strip optional leading/trailing currency symbols and whitespaces
    s = s.replace(/^[₹$]\s*|^(INR|Rs\.?)\s*/i, '').trim();
    // Remove comma separators (e.g. 1,250.50 -> 1250.50)
    s = s.replace(/,/g, '');

    if (s.startsWith('-')) {
      throw new Error('Amount cannot be negative');
    }

    // Strip trailing dot if present (e.g. "1." -> "1")
    if (s.endsWith('.')) {
      s = s.slice(0, -1);
    }

    // Validate string pattern (digits optionally followed by a dot and digits)
    if (!/^\d+(\.\d+)?$/.test(s)) {
      throw new Error(`Invalid currency string: "${val}"`);
    }

    const parts = s.split('.');
    const wholeStr = parts[0] ?? '0';
    const fracStr = parts[1];

    if (fracStr !== undefined && fracStr.length > 2) {
      throw new Error('Cannot have more than 2 decimal places');
    }

    const whole = parseInt(wholeStr, 10);
    let frac = 0;

    if (fracStr !== undefined) {
      if (fracStr.length === 1) {
        frac = parseInt(fracStr, 10) * 10;
      } else if (fracStr.length === 2) {
        frac = parseInt(fracStr, 10);
      }
    }

    const totalPaise = whole * 100 + frac;

    if (!Number.isSafeInteger(totalPaise)) {
      throw new Error('Amount exceeds safe integer range');
    }

    if (totalPaise > MAX_PAISE) {
      throw new Error(`Amount exceeds maximum limit of ${MAX_PAISE} paise`);
    }

    return totalPaise;
  }

  throw new Error('Unsupported amount type');
}

/**
 * Converts integer paise back to a rupee float for calculations or display.
 */
export function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Formats an integer paise value into Indian Rupee currency format (e.g., ₹1,23,456.78).
 * Uses Intl.NumberFormat with 'en-IN' locale.
 */
export function formatINR(paise: number, options: FormatOptions = {}): string {
  const { showPaise = true, signDisplay = 'auto' } = options;
  const isNegative = paise < 0;
  const absPaise = isNegative ? -paise : paise;
  const rupeeValue = absPaise / 100;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
    signDisplay: 'never',
  });

  const formatted = formatter.format(rupeeValue);

  if (isNegative) {
    return `-${formatted}`;
  }

  if (signDisplay === 'always' && rupeeValue > 0) {
    return `+${formatted}`;
  }

  return formatted;
}

/**
 * Safely sums an array of paise amounts.
 * Throws an error if any element is non-integer or invalid.
 */
export function sum(amountsInPaise: number[]): number {
  let total = 0;
  for (const amt of amountsInPaise) {
    if (typeof amt !== 'number' || !Number.isSafeInteger(amt)) {
      throw new Error(`Invalid safe integer paise amount: ${amt}`);
    }
    total += amt;
    if (!Number.isSafeInteger(total)) {
      throw new Error('Sum exceeded safe integer limit');
    }
  }

  return total;
}

/**
 * Derives net balance, total income, and total expenses in paise from a transaction list.
 * Single source of truth calculation.
 */
export function calculateDerivedBalance(
  transactions: Array<{ type: 'income' | 'expense'; amount_paise: number }>
): {
  incomePaise: number;
  expensePaise: number;
  netBalancePaise: number;
} {
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    if (typeof t.amount_paise !== 'number' || !Number.isSafeInteger(t.amount_paise)) {
      throw new Error(`Invalid transaction amount_paise: ${t.amount_paise}`);
    }
    if (t.type === 'income') {
      income += t.amount_paise;
    } else if (t.type === 'expense') {
      expense += t.amount_paise;
    }
  }

  return {
    incomePaise: income,
    expensePaise: expense,
    netBalancePaise: income - expense,
  };
}
