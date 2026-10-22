import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { POST } from '@/app/api/transactions/parse-image/route';
import { parseImageTransaction } from '@/lib/ai/parse-image';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

vi.mock('@/lib/ai/parse-image', () => ({ parseImageTransaction: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({ getAuthenticatedUser: vi.fn() }));

describe('Transaction image parsing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      id: 'd6dc1072-2b4d-49df-8b45-4ef98327cc73',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(0).toISOString(),
    } as User);
  });

  it('requires an authenticated session', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const formData = new FormData();
    formData.set('image', new File(['image'], 'receipt.png', { type: 'image/png' }));

    const response = await POST(
      new NextRequest('http://localhost:3000/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(401);
    expect(parseImageTransaction).not.toHaveBeenCalled();
  });

  it('rejects unsupported image types before parsing', async () => {
    const formData = new FormData();
    formData.set('image', new File(['image'], 'receipt.gif', { type: 'image/gif' }));

    const response = await POST(
      new NextRequest('http://localhost:3000/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(415);
    expect(parseImageTransaction).not.toHaveBeenCalled();
  });

  it('rejects images larger than 6 MB before parsing', async () => {
    const formData = new FormData();
    formData.set(
      'image',
      new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'receipt.png', { type: 'image/png' })
    );

    const response = await POST(
      new NextRequest('http://localhost:3000/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(413);
    expect(parseImageTransaction).not.toHaveBeenCalled();
  });

  it('returns extracted transaction details for review', async () => {
    vi.mocked(parseImageTransaction).mockResolvedValue({
      status: 'success',
      intent: 'transaction',
      confidence: 0.92,
      clarification_needed: false,
      transaction: {
        type: 'expense',
        amount_paise: 12500,
        category: 'Food & Dining',
        merchant: 'Cafe',
        note: null,
        occurred_at: '2026-10-21T12:00:00.000Z',
      },
    });
    const formData = new FormData();
    formData.set('image', new File(['image'], 'receipt.png', { type: 'image/png' }));

    const response = await POST(
      new NextRequest('http://localhost:3000/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      transaction: {
        amount_paise: 12500,
        merchant: 'Cafe',
        confidence: 0.92,
      },
    });
  });

  it('does not treat unreadable images as transactions', async () => {
    vi.mocked(parseImageTransaction).mockResolvedValue({
      status: 'unreadable',
      intent: 'unknown',
      confidence: 0,
      clarification_needed: false,
      transaction: null,
    });
    const formData = new FormData();
    formData.set('image', new File(['image'], 'receipt.png', { type: 'image/png' }));

    const response = await POST(
      new NextRequest('http://localhost:3000/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(422);
    expect(parseImageTransaction).toHaveBeenCalledOnce();
  });
});
