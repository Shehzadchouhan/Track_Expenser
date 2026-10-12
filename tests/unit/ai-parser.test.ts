import { describe, it, expect } from 'vitest';
import { checkFastCommand } from '@/lib/ai/parse-text';
import { AIParseResultSchema } from '@/lib/ai/types';

describe('AI Parser & Command Handlers', () => {
  describe('checkFastCommand', () => {
    it('detects undo commands instantaneously', () => {
      expect(checkFastCommand('undo')?.intent).toBe('undo');
      expect(checkFastCommand('Cancel')?.intent).toBe('undo');
      expect(checkFastCommand('revert')?.intent).toBe('undo');
      expect(checkFastCommand('delete last')?.intent).toBe('undo');
    });

    it('detects help and greeting commands', () => {
      expect(checkFastCommand('help')?.intent).toBe('help');
      expect(checkFastCommand('hi')?.intent).toBe('help');
      expect(checkFastCommand('/start')?.intent).toBe('help');
    });

    it('detects confirmation (yes/no) responses', () => {
      const yes = checkFastCommand('YES');
      expect(yes?.intent).toBe('clarification_response');
      expect(yes?.confirmed).toBe(true);

      const no = checkFastCommand('no');
      expect(no?.intent).toBe('clarification_response');
      expect(no?.confirmed).toBe(false);
    });

    it('returns null for actual transaction messages to let AI handle them', () => {
      expect(checkFastCommand('Spent 250 on tea')).toBeNull();
      expect(checkFastCommand('Paid ₹1200 at Zudio')).toBeNull();
      expect(checkFastCommand('Received 5000 freelance')).toBeNull();
    });
  });

  describe('AIParseResultSchema validation', () => {
    it('validates successful transaction extraction', () => {
      const mockAiOutput = {
        intent: 'transaction',
        confidence: 0.95,
        clarification_needed: false,
        status: 'success',
        transaction: {
          type: 'expense',
          amount_paise: 35000,
          category: 'Transportation',
          merchant: 'HPCL Petrol',
          note: 'petrol refill',
          occurred_at: '2026-10-10T11:00:00.000Z',
        },
      };

      const result = AIParseResultSchema.safeParse(mockAiOutput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transaction?.amount_paise).toBe(35000);
        expect(result.data.transaction?.merchant).toBe('HPCL Petrol');
      }
    });

    it('validates clarification prompt on low confidence', () => {
      const mockClarification = {
        intent: 'transaction',
        confidence: 0.6,
        clarification_needed: true,
        clarification_prompt: 'Did you mean ₹200 for Food & Dining? Reply YES to confirm.',
        status: 'success',
        transaction: {
          type: 'expense',
          amount_paise: 20000,
          category: 'Food & Dining',
          merchant: null,
          note: 'lunch',
          occurred_at: '2026-10-10T11:00:00.000Z',
        },
      };

      const result = AIParseResultSchema.safeParse(mockClarification);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clarification_needed).toBe(true);
        expect(result.data.clarification_prompt).toContain('Did you mean ₹200');
      }
    });

    it('validates payment failed status from screenshots', () => {
      const mockFailedScreenshot = {
        intent: 'transaction',
        confidence: 0.9,
        clarification_needed: false,
        status: 'failed_payment',
        clarification_prompt: '⚠️ Payment shows as failed or declined. Not logging.',
        transaction: null,
      };

      const result = AIParseResultSchema.safeParse(mockFailedScreenshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('failed_payment');
        expect(result.data.transaction).toBeNull();
      }
    });

    it('resiliently handles non-standard date formats from Vision AI receipts without crashing', () => {
      const mockVisionOutput = {
        intent: 'payment', // fuzzy intent
        confidence: '95', // percentage string
        status: 'completed', // non-standard status string
        transaction: {
          type: 'expense',
          amount_paise: '25000', // string amount
          category: 'Transportation',
          merchant: 'Uber India',
          occurred_at: '2026-10-12 11:25:00', // non-ISO without Z (the exact bug that crashed earlier)
        },
      };

      const result = AIParseResultSchema.safeParse(mockVisionOutput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.intent).toBe('transaction');
        expect(result.data.status).toBe('success');
        expect(result.data.confidence).toBe(0.95);
        expect(result.data.transaction?.amount_paise).toBe(25000);
        expect(result.data.transaction?.merchant).toBe('Uber India');
        // Confirms occurred_at is safely normalized to a valid ISO datetime
        expect(result.data.transaction?.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('flexibly maps intent synonyms like extract_transaction, debit, and statement', () => {
      const synonyms = ['extract_transaction', 'record_transaction', 'debit', 'credit', 'statement', 'bill'];
      for (const intentName of synonyms) {
        const parsed = AIParseResultSchema.parse({
          intent: intentName,
          transaction: {
            type: 'expense',
            amount_paise: 50000,
            category: 'Shopping',
          },
        });
        expect(parsed.intent).toBe('transaction');
        expect(parsed.transaction?.amount_paise).toBe(50000);
      }
    });

    it('recovers unknown intent as transaction when valid transaction with amount is present', () => {
      const parsed = AIParseResultSchema.parse({
        intent: 'unknown',
        transaction: {
          type: 'income',
          amount_paise: 7000,
          category: 'Other Income',
          merchant: 'Saurav',
        },
      });
      expect(parsed.intent).toBe('transaction');
      expect(parsed.transaction?.amount_paise).toBe(7000);
    });
  });
});
