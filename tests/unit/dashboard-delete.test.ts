import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/dashboard/route';

vi.mock('@/lib/supabase/admin', () => {
  return {
    createAdminClient: vi.fn(),
  };
});

describe('Dashboard DELETE API Route', () => {
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdmin = {
      from: vi.fn(),
    };
  });

  it('deletes a single transaction by ID', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const mockEqTxId = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqTxId });

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return { delete: mockDelete };
      }
      return {};
    });

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any);

    const req = new NextRequest('http://localhost:3000/api/dashboard?id=tx-123', {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedId).toBe('tx-123');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('resets weekly transactions for a verified user', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const mockGte = vi.fn().mockResolvedValue({ error: null });
    const mockEqUser = vi.fn().mockReturnValue({ gte: mockGte });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'user_settings') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { user_id: 'user-456' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return { delete: mockDelete };
      }
      return {};
    });

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any);

    const req = new NextRequest(
      'http://localhost:3000/api/dashboard?action=reset_weekly&phone=%2B919988059285',
      { method: 'DELETE' }
    );

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('reset_weekly');
    expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-456');
    expect(mockGte).toHaveBeenCalled();
  });

  it('resets all transactions for a user', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const mockEqUser = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'user_settings') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { user_id: 'user-789' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return { delete: mockDelete };
      }
      return {};
    });

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any);

    const req = new NextRequest(
      'http://localhost:3000/api/dashboard?action=reset_all&phone=%2B919988059285',
      { method: 'DELETE' }
    );

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('reset_all');
    expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-789');
  });

  it('returns 400 when missing both id and action parameters', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any);

    const req = new NextRequest('http://localhost:3000/api/dashboard', {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing id or action parameter');
  });
});
