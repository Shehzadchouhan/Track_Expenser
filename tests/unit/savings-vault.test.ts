import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { POST } from '@/app/api/dashboard/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { isValidUpiId, buildUpiPayUrl } from '@/lib/upi';
import {
  UpdateSavingsUpiSchema,
  UpdateAccountGoalSchema,
  AccountSchema,
} from '@/lib/schemas';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({ getAuthenticatedUser: vi.fn() }));

describe('Phase 3: Savings Vault & UPI Integration', () => {
  describe('UPI Utilities (isValidUpiId & buildUpiPayUrl)', () => {
    it('correctly validates valid Indian UPI VPAs', () => {
      expect(isValidUpiId('user@okhdfcbank')).toBe(true);
      expect(isValidUpiId('9876543210@paytm')).toBe(true);
      expect(isValidUpiId('john.doe@icici')).toBe(true);
      expect(isValidUpiId('shop_pay@upi')).toBe(true);
      expect(isValidUpiId('my-wallet@axisbank')).toBe(true);
    });

    it('rejects invalid UPI VPAs', () => {
      expect(isValidUpiId('')).toBe(false);
      expect(isValidUpiId('notanupi')).toBe(false);
      expect(isValidUpiId('@okhdfcbank')).toBe(false);
      expect(isValidUpiId('user@')).toBe(false);
      expect(isValidUpiId('user name@okhdfcbank')).toBe(false);
      expect(isValidUpiId('user@@bank')).toBe(false);
    });

    it('builds NPCI-compliant upi://pay intent URLs', () => {
      const url = buildUpiPayUrl({
        upiId: 'user@okhdfcbank',
        payeeName: 'Savings Vault',
        amountRupees: 500,
        transactionNote: 'Track Expenser Savings Deposit',
      });

      expect(url).toBe(
        'upi://pay?pa=user%40okhdfcbank&pn=Savings+Vault&am=500.00&cu=INR&tn=Track+Expenser+Savings+Deposit'
      );
    });

    it('formats decimal amounts correctly in UPI intent URLs', () => {
      const url = buildUpiPayUrl({
        upiId: '9876543210@paytm',
        amountRupees: 1250.5,
      });

      expect(url).toContain('am=1250.50');
      expect(url).toContain('cu=INR');
      expect(url).toContain('pa=9876543210%40paytm');
    });
  });

  describe('Savings Validation Schemas', () => {
    it('validates UpdateSavingsUpiSchema with valid and empty UPI IDs', () => {
      expect(UpdateSavingsUpiSchema.safeParse({ savings_upi_id: 'user@okhdfcbank' }).success).toBe(true);
      expect(UpdateSavingsUpiSchema.safeParse({ savings_upi_id: '' }).success).toBe(true);
      expect(UpdateSavingsUpiSchema.safeParse({ savings_upi_id: 'invalid-id' }).success).toBe(false);
    });

    it('validates UpdateAccountGoalSchema with integer paise', () => {
      const validUuid = 'd6dc1072-2b4d-49df-8b45-4ef98327cc73';

      expect(
        UpdateAccountGoalSchema.safeParse({
          account_id: validUuid,
          target_goal_paise: 5000000,
        }).success
      ).toBe(true);

      expect(
        UpdateAccountGoalSchema.safeParse({
          account_id: validUuid,
          target_goal_paise: null,
        }).success
      ).toBe(true);

      expect(
        UpdateAccountGoalSchema.safeParse({
          account_id: 'not-a-uuid',
          target_goal_paise: 50000,
        }).success
      ).toBe(false);

      expect(
        UpdateAccountGoalSchema.safeParse({
          account_id: validUuid,
          target_goal_paise: -100,
        }).success
      ).toBe(false);
    });

    it('supports target_goal_paise in AccountSchema', () => {
      const res = AccountSchema.safeParse({
        name: 'Emergency Fund',
        type: 'bank',
        purpose: 'savings',
        opening_balance_paise: 0,
        target_goal_paise: 10000000,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.purpose).toBe('savings');
        expect(res.data.target_goal_paise).toBe(10000000);
      }
    });
  });

  describe('Dashboard Savings API Mutations', () => {
    const userId = 'd6dc1072-2b4d-49df-8b45-4ef98327cc73';
    const mockAdmin = { from: vi.fn() };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: userId,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date(0).toISOString(),
      } as User);
    });

    it('updates savings UPI ID via POST action: update_savings_upi', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockAdmin.from.mockImplementation((table: string) => {
        if (table === 'user_settings') {
          return { upsert: upsertMock };
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_savings_upi',
          savings_upi_id: 'user@okhdfcbank',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.savingsUpiId).toBe('user@okhdfcbank');
      expect(upsertMock).toHaveBeenCalledWith(
        { user_id: userId, savings_upi_id: 'user@okhdfcbank' },
        { onConflict: 'user_id' }
      );
    });

    it('updates target goal for an account via POST action: update_account_goal', async () => {
      const validAccountId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const singleMock = vi.fn().mockResolvedValue({
        data: { id: validAccountId, name: 'Savings Vault', target_goal_paise: 5000000 },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqUserMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });

      mockAdmin.from.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return { update: updateMock };
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_account_goal',
          account_id: validAccountId,
          target_goal_paise: 5000000,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.account.target_goal_paise).toBe(5000000);
      expect(updateMock).toHaveBeenCalledWith({ target_goal_paise: 5000000 });
    });

    it('creates a new savings vault account via POST action: create_account', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Gold Fund',
          type: 'bank',
          purpose: 'savings',
          opening_balance_paise: 0,
          target_goal_paise: 2000000,
          is_default: false,
        },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });

      mockAdmin.from.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return { insert: insertMock };
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_account',
          name: 'Gold Fund',
          type: 'bank',
          purpose: 'savings',
          opening_balance_paise: 0,
          target_goal_paise: 2000000,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.account.name).toBe('Gold Fund');
      expect(data.account.purpose).toBe('savings');
      expect(data.account.target_goal_paise).toBe(2000000);
    });
  });
});
