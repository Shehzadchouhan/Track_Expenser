import { describe, it, expect } from 'vitest';
import {
  PhoneVerificationRequestSchema,
  PhoneVerificationConfirmSchema,
  TransactionSchema,
  UserSettingsSchema,
} from '@/lib/schemas';

describe('Validation Schemas', () => {
  describe('PhoneVerificationRequestSchema', () => {
    it('accepts valid E.164 phone numbers', () => {
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '+919876543210' }).success).toBe(true);
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '+14155552671' }).success).toBe(true);
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '+447911123456' }).success).toBe(true);
    });

    it('rejects numbers without + or invalid characters', () => {
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '9876543210' }).success).toBe(false);
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '+0123456789' }).success).toBe(false); // leading 0 country code invalid
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '+91-98765-43210' }).success).toBe(false);
      expect(PhoneVerificationRequestSchema.safeParse({ phone_number: '' }).success).toBe(false);
    });
  });

  describe('PhoneVerificationConfirmSchema', () => {
    it('accepts valid 6-digit OTP and phone', () => {
      const res = PhoneVerificationConfirmSchema.safeParse({
        phone_number: '+919876543210',
        otp_code: '123456',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid OTP length or alphanumeric codes', () => {
      expect(
        PhoneVerificationConfirmSchema.safeParse({
          phone_number: '+919876543210',
          otp_code: '12345', // 5 digits
        }).success
      ).toBe(false);

      expect(
        PhoneVerificationConfirmSchema.safeParse({
          phone_number: '+919876543210',
          otp_code: '1234567', // 7 digits
        }).success
      ).toBe(false);

      expect(
        PhoneVerificationConfirmSchema.safeParse({
          phone_number: '+919876543210',
          otp_code: '12345a', // alpha
        }).success
      ).toBe(false);
    });
  });

  describe('TransactionSchema with WhatsApp metadata', () => {
    it('accepts valid transaction with whatsapp metadata', () => {
      const valid = {
        type: 'expense' as const,
        amount_paise: 25000,
        merchant: 'Starbucks',
        source: 'whatsapp_text' as const,
        whatsapp_message_id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ1RDk1QTE5Qzg5Mjg5OTQA',
        raw_input: 'spent 250 at starbucks',
        occurred_at: new Date().toISOString(),
      };
      const res = TransactionSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('defaults source to web when not provided', () => {
      const payload = {
        type: 'expense' as const,
        amount_paise: 10000,
        occurred_at: new Date().toISOString(),
      };
      const res = TransactionSchema.safeParse(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.source).toBe('web');
      }
    });
  });

  describe('UserSettingsSchema', () => {
    it('validates user settings properly', () => {
      const res = UserSettingsSchema.safeParse({
        phone_number: '+919876543210',
        monthly_budget_paise: 3000000, // ₹30,000
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });
      expect(res.success).toBe(true);
    });
  });
});
