import { z } from 'zod';
import {
  MAX_PAISE,
  MIN_PAISE,
  TRANSACTION_TYPES,
  CATEGORY_KINDS,
  TRANSACTION_SOURCES,
  E164_PHONE_REGEX,
  OTP_CODE_REGEX,
} from './constants';

export const CategoryKindSchema = z.enum(CATEGORY_KINDS);
export const TransactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const TransactionSourceSchema = z.enum(TRANSACTION_SOURCES);

export const CategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name must be at least 1 character')
    .max(40, 'Category name must not exceed 40 characters'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid 6-character hex code (e.g. #10B981)'),
  kind: CategoryKindSchema,
});

export const TransactionSchema = z.object({
  type: TransactionTypeSchema,
  amount_paise: z
    .number()
    .int('Amount in paise must be an integer')
    .min(MIN_PAISE, 'Amount must be at least 1 paise')
    .max(MAX_PAISE, 'Amount must not exceed ₹10,00,00,000 (10,000,000,000 paise)'),
  category_id: z.string().uuid().nullable().optional(),
  note: z
    .string()
    .trim()
    .max(280, 'Note must not exceed 280 characters')
    .nullable()
    .optional(),
  merchant: z
    .string()
    .trim()
    .max(100, 'Merchant must not exceed 100 characters')
    .nullable()
    .optional(),
  source: TransactionSourceSchema.default('web'),
  whatsapp_message_id: z.string().trim().nullable().optional(),
  raw_input: z
    .string()
    .trim()
    .max(1000, 'Raw input must not exceed 1000 characters')
    .nullable()
    .optional(),
  occurred_at: z.string().datetime({ message: 'occurred_at must be an ISO-8601 timestamp' }),
});

export const BudgetSchema = z.object({
  category_id: z.string().uuid('Category must be a valid UUID'),
  monthly_limit_paise: z
    .number()
    .int('Monthly limit in paise must be an integer')
    .min(MIN_PAISE, 'Budget limit must be at least 1 paise')
    .max(MAX_PAISE, 'Budget limit must not exceed ₹10,00,00,000 (10,000,000,000 paise)'),
});

export const PhoneVerificationRequestSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(
      E164_PHONE_REGEX,
      'Invalid phone number format. Must be E.164 international format (e.g. +919876543210)'
    ),
});

export const PhoneVerificationConfirmSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(
      E164_PHONE_REGEX,
      'Invalid phone number format. Must be E.164 international format (e.g. +919876543210)'
    ),
  otp_code: z
    .string()
    .trim()
    .regex(OTP_CODE_REGEX, 'OTP code must be exactly 6 digits'),
});

export const UserSettingsSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, 'Invalid phone number format')
    .nullable()
    .optional(),
  monthly_budget_paise: z
    .number()
    .int()
    .min(MIN_PAISE)
    .max(MAX_PAISE)
    .nullable()
    .optional(),
  currency: z.string().trim().min(3).max(4).default('INR'),
  timezone: z.string().trim().default('Asia/Kolkata'),
});
