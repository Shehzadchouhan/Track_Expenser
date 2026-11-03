import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/share-receipt/route';
import { parseImageTransaction } from '@/lib/ai/parse-image';
import { parseTextTransaction } from '@/lib/ai/parse-text';

vi.mock('@/lib/ai/parse-image', () => ({ parseImageTransaction: vi.fn() }));
vi.mock('@/lib/ai/parse-text', () => ({ parseTextTransaction: vi.fn() }));

describe('Share Receipt Route (Web Share Target)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects with parsed transaction query params when an image receipt is shared', async () => {
    vi.mocked(parseImageTransaction).mockResolvedValue({
      status: 'success',
      intent: 'transaction',
      confidence: 0.95,
      clarification_needed: false,
      transaction: {
        type: 'expense',
        amount_paise: 45000,
        merchant: 'Swiggy',
        category: 'Food & Dining',
        note: 'Lunch order',
        occurred_at: '2026-11-03T12:00:00Z',
      },
    });

    const formData = new FormData();
    formData.set('receipt', new File(['dummy-bytes'], 'gpay-receipt.png', { type: 'image/png' }));

    const req = new NextRequest('http://localhost:3000/share-receipt', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get('location');
    expect(location).toContain('shared_amount=45000');
    expect(location).toContain('shared_merchant=Swiggy');
    expect(location).toContain('shared_type=expense');
  });

  it('redirects with parsed query params when text transaction is shared', async () => {
    vi.mocked(parseTextTransaction).mockResolvedValue({
      status: 'success',
      intent: 'transaction',
      confidence: 0.9,
      clarification_needed: false,
      transaction: {
        type: 'expense',
        amount_paise: 12000,
        merchant: 'Uber',
        category: 'Transportation',
        note: 'Cab ride',
        occurred_at: '2026-11-03T12:00:00Z',
      },
    });

    const formData = new FormData();
    formData.set('text', 'Paid Rs 120 to Uber on UPI');

    const req = new NextRequest('http://localhost:3000/share-receipt', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get('location');
    expect(location).toContain('shared_amount=12000');
    expect(location).toContain('shared_merchant=Uber');
  });

  it('falls back to open_scanner=1 if no recognizable transaction could be extracted', async () => {
    const formData = new FormData();

    const req = new NextRequest('http://localhost:3000/share-receipt', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get('location');
    expect(location).toContain('open_scanner=1');
  });
});
