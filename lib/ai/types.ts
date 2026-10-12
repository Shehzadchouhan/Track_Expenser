import { z } from 'zod';
import { CATEGORY_KINDS, TRANSACTION_TYPES, MIN_PAISE, MAX_PAISE } from '../constants';

function safeIsoDate(val: unknown, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback || new Date().toISOString();
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback || new Date().toISOString();
}

export const AIIntentSchema = z.enum([
  'transaction',
  'undo',
  'clarification_response',
  'help',
  'unknown',
]);
export type AIIntent = z.infer<typeof AIIntentSchema>;

export const AITransactionDataSchema = z.object({
  type: z
    .preprocess((val) => {
      const s = String(val || '').toLowerCase().trim();
      return s === 'income' ? 'income' : 'expense';
    }, z.enum(TRANSACTION_TYPES))
    .default('expense'),

  amount_paise: z
    .preprocess((val) => {
      if (typeof val === 'number') {
        return Math.round(val);
      }
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.round(num);
      }
      return 0;
    }, z.number().int())
    .refine((val) => val >= MIN_PAISE && val <= MAX_PAISE, {
      message: `Amount must be between ${MIN_PAISE} and ${MAX_PAISE} paise`,
    }),

  category: z
    .preprocess((val) => {
      const s = typeof val === 'string' ? val.trim() : '';
      return s || 'Other Expense';
    }, z.string())
    .default('Other Expense'),

  merchant: z
    .preprocess((val) => {
      if (!val) return null;
      const s = String(val).trim();
      return s.length > 0 ? s.slice(0, 100) : null;
    }, z.string().nullable().optional()),

  note: z
    .preprocess((val) => {
      if (!val) return null;
      const s = String(val).trim();
      return s.length > 0 ? s.slice(0, 280) : null;
    }, z.string().nullable().optional()),

  occurred_at: z
    .preprocess((val) => (val ? safeIsoDate(val) : undefined), z.string().optional())
    .optional(),
});
export type AITransactionData = z.infer<typeof AITransactionDataSchema>;

export const AIParseResultSchema = z
  .object({
    intent: z
      .preprocess((val) => {
        const s = String(val || '').toLowerCase().trim();
        if (
          s.includes('transaction') ||
          s.includes('expense') ||
          s.includes('income') ||
          s.includes('payment') ||
          s.includes('debit') ||
          s.includes('credit') ||
          s.includes('statement') ||
          s.includes('bill') ||
          s.includes('transfer')
        ) {
          return 'transaction';
        }
        if (['undo', 'cancel', 'revert'].includes(s)) return 'undo';
        if (['help', 'hi', 'start'].includes(s)) return 'help';
        if (['clarification_response', 'confirm'].includes(s)) return 'clarification_response';
        return 'unknown';
      }, AIIntentSchema),

    confidence: z
      .preprocess((val) => {
        if (typeof val === 'number') {
          return val > 1 ? Math.min(val / 100, 1) : Math.max(0, val);
        }
        if (typeof val === 'string') {
          const num = parseFloat(val);
          if (isNaN(num)) return 0.8;
          return num > 1 ? Math.min(num / 100, 1) : Math.max(0, num);
        }
        return 0.8;
      }, z.number().min(0).max(1))
      .default(0.8),

    clarification_needed: z
      .preprocess((val) => Boolean(val), z.boolean())
      .default(false),

    clarification_prompt: z
      .preprocess((val) => (val ? String(val).trim() : null), z.string().nullable().optional()),

    transaction: AITransactionDataSchema.nullable().optional(),

    confirmed: z.boolean().nullable().optional(),

    status: z
      .preprocess((val) => {
        const s = String(val || '').toLowerCase().trim();
        if (['failed', 'failed_payment', 'declined', 'cancelled'].includes(s)) return 'failed_payment';
        if (['unreadable', 'invalid', 'error'].includes(s)) return 'unreadable';
        if (['ignored', 'irrelevant'].includes(s)) return 'ignored';
        return 'success';
      }, z.enum(['success', 'failed_payment', 'unreadable', 'ignored']))
      .default('success'),

    raw_message: z.string().optional(),
  })
  .transform((data) => {
    // If a valid transaction with positive amount was extracted, ensure intent is 'transaction'
    if (data.transaction && data.transaction.amount_paise > 0 && data.intent === 'unknown') {
      return { ...data, intent: 'transaction' as const };
    }
    return data;
  });
export type AIParseResult = z.infer<typeof AIParseResultSchema>;
