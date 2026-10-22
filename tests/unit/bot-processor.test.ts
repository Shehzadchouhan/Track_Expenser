import { describe, it, expect, vi } from 'vitest';
import { processIncomingWhatsAppMessage } from '@/lib/bot/processor';
import { ExtractedMessage } from '@/lib/whatsapp/types';
import { parseTextTransaction } from '@/lib/ai/parse-text';

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => {
  return {
    createAdminClient: vi.fn(),
  };
});

// Mock WhatsApp client
vi.mock('@/lib/whatsapp/client', () => {
  return {
    whatsappClient: {
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
      downloadMediaAsBase64: vi.fn().mockResolvedValue({ base64: 'abc', mimeType: 'image/jpeg' }),
    },
  };
});

vi.mock('@/lib/ai/parse-text', () => ({
  checkFastCommand: vi.fn((text: string) => (text === 'help' ? { intent: 'help' } : null)),
  parseTextTransaction: vi.fn(),
}));

describe('WhatsApp Bot Processor', () => {
  it('returns unlinked_user when phone is not verified in database', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as never);

    const message: ExtractedMessage = {
      fromPhone: '+919999999999',
      rawPhone: '919999999999',
      messageId: 'wamid.123',
      senderName: 'Stranger',
      type: 'text',
      text: 'Spent 200 on snacks',
      timestamp: '1728550000',
    };

    const result = await processIncomingWhatsAppMessage(message);
    expect(result.status).toBe('unlinked_user');
  });

  it('handles help command for verified users', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: 'user-uuid-123',
        phone_number: '+919876543210',
        phone_verified: true,
        timezone: 'Asia/Kolkata',
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as never);

    const message: ExtractedMessage = {
      fromPhone: '+919876543210',
      rawPhone: '919876543210',
      messageId: 'wamid.456',
      senderName: 'Shehzad',
      type: 'text',
      text: 'help',
      timestamp: '1728550000',
    };

    const result = await processIncomingWhatsAppMessage(message);
    expect(result.status).toBe('help');
  });

  it('records forwarded bank SMS text as a WhatsApp transaction', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const smsText = 'INR 250.00 debited from A/c XX1234 at ABC Stores on 21-Oct-2026';
    vi.mocked(parseTextTransaction).mockResolvedValue({
      intent: 'transaction',
      confidence: 0.95,
      clarification_needed: false,
      status: 'success',
      transaction: {
        type: 'expense',
        amount_paise: 25000,
        category: 'Shopping',
        merchant: 'ABC Stores',
        note: null,
        occurred_at: '2026-10-21T12:00:00.000Z',
      },
    });

    const verifiedUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-uuid-123',
          phone_number: '+919876543210',
          phone_verified: true,
          timezone: 'Asia/Kolkata',
        },
        error: null,
      }),
    };
    const categoryQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ id: 'category-shopping', name: 'Shopping', kind: 'expense' }],
        error: null,
      }),
    };
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'transaction-123' }, error: null }),
      }),
    });
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'user_settings') return verifiedUserQuery;
        if (table === 'categories') return categoryQuery;
        return { insert };
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never);

    const message: ExtractedMessage = {
      fromPhone: '+919876543210',
      rawPhone: '919876543210',
      messageId: 'wamid.sms.1',
      senderName: 'Shehzad',
      type: 'text',
      text: smsText,
      timestamp: '1792584000',
    };

    const result = await processIncomingWhatsAppMessage(message);

    expect(parseTextTransaction).toHaveBeenCalledWith(smsText);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid-123',
        amount_paise: 25000,
        source: 'whatsapp_text',
        raw_input: smsText,
        occurred_at: '2026-10-21T12:00:00.000Z',
      })
    );
    expect(result).toMatchObject({ status: 'recorded', transactionId: 'transaction-123' });
  });
});
