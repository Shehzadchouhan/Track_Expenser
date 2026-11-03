export const APP_TIMEZONE = 'Asia/Kolkata';

export const MIN_PAISE = 1;
export const MAX_PAISE = 10_000_000_000; // 10 Crore INR in paise (₹10,00,00,000)

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_SOURCES = ['web', 'whatsapp_text', 'whatsapp_image'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const CATEGORY_KINDS = ['income', 'expense'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const ACCOUNT_TYPES = ['bank', 'cash', 'wallet'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_PURPOSES = ['spending', 'savings'] as const;
export type AccountPurpose = (typeof ACCOUNT_PURPOSES)[number];

export const DEFAULT_ACCOUNTS = [
  { name: 'Bank / UPI', type: 'bank' as const, purpose: 'spending' as const, opening_balance_paise: 0, target_goal_paise: null as number | null, is_default: true },
  { name: 'Cash', type: 'cash' as const, purpose: 'spending' as const, opening_balance_paise: 0, target_goal_paise: null as number | null, is_default: false },
  { name: 'Savings Vault', type: 'bank' as const, purpose: 'savings' as const, opening_balance_paise: 0, target_goal_paise: 5000000 as number | null, is_default: false },
];

export const DEFAULT_CURRENCY = 'INR';
export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
export const OTP_CODE_REGEX = /^\d{6}$/;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_EXPIRY_MINUTES = 10;

export const DEFAULT_CATEGORIES = [
  // Income & Adding Balance
  { name: 'Online Deposit', color: '#3B82F6', kind: 'income' as const },
  { name: 'Cash Deposit', color: '#F59E0B', kind: 'income' as const },
  { name: 'Salary', color: '#10B981', kind: 'income' as const },
  { name: 'Freelance', color: '#06B6D4', kind: 'income' as const },
  { name: 'Investment', color: '#14B8A6', kind: 'income' as const },
  { name: 'Other Income', color: '#22C55E', kind: 'income' as const },
  // Expense
  { name: 'Food & Dining', color: '#F59E0B', kind: 'expense' as const },
  { name: 'Groceries', color: '#84CC16', kind: 'expense' as const },
  { name: 'Transportation', color: '#3B82F6', kind: 'expense' as const },
  { name: 'Housing & Utilities', color: '#8B5CF6', kind: 'expense' as const },
  { name: 'Entertainment', color: '#EC4899', kind: 'expense' as const },
  { name: 'Health & Medical', color: '#EF4444', kind: 'expense' as const },
  { name: 'Shopping', color: '#F97316', kind: 'expense' as const },
  { name: 'Other Expense', color: '#64748B', kind: 'expense' as const },
];
