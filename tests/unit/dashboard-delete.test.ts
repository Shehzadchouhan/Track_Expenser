import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { DELETE, GET, POST } from '@/app/api/dashboard/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({ getAuthenticatedUser: vi.fn() }));

describe('Dashboard DELETE & Mutation API Routes', () => {
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

  it('rejects transaction deletion without an authenticated session', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard?id=d6dc1072-2b4d-49df-8b45-4ef98327cc73',
      { method: 'DELETE' }
    );

    const response = await DELETE(request);

    expect(response.status).toBe(401);
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it('rejects dashboard reads and mutations without an authenticated session', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

    const getResponse = await GET();
    const postResponse = await POST(
      new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_transaction',
          type: 'expense',
          amount_paise: 10000,
          category_name: 'Food & Dining',
        }),
      })
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it('uses the authenticated user instead of a caller-supplied phone number', async () => {
    const transactionId = '5d7e239a-6b21-44c6-a04a-c67c47f31d85';
    const findCategories = vi.fn().mockResolvedValue({ data: [], error: null });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: transactionId }, error: null }),
      }),
    });
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'categories') {
        return { select: vi.fn().mockReturnValue({ eq: findCategories }) };
      }
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return { insert };
    });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+919876543210',
          action: 'add_transaction',
          type: 'expense',
          amount_paise: 10000,
          category_name: 'Food & Dining',
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transaction.id).toBe(transactionId);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId, amount_paise: 10000 })
    );
  });

  it('scopes transaction deletion to the authenticated user', async () => {
    const transactionId = '5d7e239a-6b21-44c6-a04a-c67c47f31d85';
    const deleteForUser = vi.fn().mockResolvedValue({ error: null });
    const matchTransaction = vi.fn().mockReturnValue({ eq: deleteForUser });
    const deleteTransactions = vi.fn().mockReturnValue({ eq: matchTransaction });
    mockAdmin.from.mockReturnValue({ delete: deleteTransactions });

    const request = new NextRequest(
      `http://localhost:3000/api/dashboard?id=${transactionId}`,
      { method: 'DELETE' }
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, deletedId: transactionId });
    expect(mockAdmin.from).toHaveBeenCalledWith('transactions');
    expect(matchTransaction).toHaveBeenCalledWith('id', transactionId);
    expect(deleteForUser).toHaveBeenCalledWith('user_id', userId);
  });

  it('resets transactions only for the authenticated user', async () => {
    const deleteForUser = vi.fn().mockResolvedValue({ error: null });
    const deleteTransactions = vi.fn().mockReturnValue({ eq: deleteForUser });
    mockAdmin.from.mockReturnValue({ delete: deleteTransactions });

    const request = new NextRequest(
      'http://localhost:3000/api/dashboard?action=reset_all',
      { method: 'DELETE' }
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, action: 'reset_all' });
    expect(mockAdmin.from).toHaveBeenCalledWith('transactions');
    expect(deleteForUser).toHaveBeenCalledWith('user_id', userId);
  });

  it('rejects malformed transaction IDs without running a delete', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard?id=not-a-uuid',
      { method: 'DELETE' }
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid transaction ID.');
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it('rejects resets without an action', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing transaction ID or reset action.');
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it('handles account reconciliation by creating an adjustment transaction', async () => {
    const accountId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: accountId, name: 'Cash', opening_balance_paise: 200000 },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ type: 'expense', amount_paise: 50000, account_id: accountId }],
              error: null,
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'adj-tx-id' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Opening 2,000 - expense 500 = 1,500. Actual = 2,500 (+1,000 difference)
    const response = await POST(
      new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_account',
          account_id: accountId,
          actual_balance_paise: 250000,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.adjustedPaise).toBe(100000);
    expect(data.newBalancePaise).toBe(250000);
  });
});
