import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processIncomingWhatsAppMessage } from '@/lib/bot/processor';
import { ExtractedMessage } from '@/lib/whatsapp/types';
import { parseTextTransaction, checkFastCommand } from '@/lib/ai/parse-text';
import { parseImageTransaction } from '@/lib/ai/parse-image';
import { createAdminClient } from '@/lib/supabase/admin';

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// Mock WhatsApp client
vi.mock('@/lib/whatsapp/client', () => ({
  whatsappClient: {
    sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    sendQuickReplyButtons: vi.fn().mockResolvedValue({ success: true }),
    downloadMediaAsBase64: vi.fn().mockResolvedValue({ base64: 'abc', mimeType: 'image/jpeg' }),
  },
}));

vi.mock('@/lib/ai/parse-text', () => ({
  checkFastCommand: vi.fn((text: string) => (text === 'help' ? { intent: 'help' } : null)),
  parseTextTransaction: vi.fn(),
}));

vi.mock('@/lib/ai/parse-image', () => ({
  parseImageTransaction: vi.fn(),
}));

describe('WhatsApp Bot Processor', () => {
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

  const accountsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: [
        { id: 'acc-bank', name: 'Bank / UPI', type: 'bank', purpose: 'spending', is_default: true },
        { id: 'acc-cash', name: 'Cash', type: 'cash', purpose: 'spending', is_default: false },
        { id: 'acc-savings', name: 'Savings Vault', type: 'bank', purpose: 'savings', is_default: false },
      ],
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unlinked_user when phone is not verified in database', async () => {
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
    vi.mocked(checkFastCommand).mockReturnValueOnce({
      intent: 'help',
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      raw_message: 'help',
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_settings') return verifiedUserQuery;
        return {};
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

  it('records forwarded bank SMS text as a WhatsApp transaction to Bank account', async () => {
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

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'transaction-123' }, error: null }),
      }),
    });
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'user_settings') return verifiedUserQuery;
        if (table === 'categories') return categoryQuery;
        if (table === 'accounts') return accountsQuery;
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
        account_id: 'acc-bank',
        source: 'whatsapp_text',
        raw_input: smsText,
        occurred_at: '2026-10-21T12:00:00.000Z',
      })
    );
    expect(result).toMatchObject({ status: 'recorded', transactionId: 'transaction-123' });
  });

  it('routes cash expense text to Cash account', async () => {
    const cashText = 'spent 80 chai cash';
    vi.mocked(parseTextTransaction).mockResolvedValue({
      intent: 'transaction',
      confidence: 0.95,
      clarification_needed: false,
      status: 'success',
      transaction: {
        type: 'expense',
        amount_paise: 8000,
        category: 'Food & Dining',
        merchant: 'Chai',
        note: null,
        occurred_at: '2026-10-21T12:00:00.000Z',
      },
    });

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'tx-cash-1' }, error: null }),
      }),
    });
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'user_settings') return verifiedUserQuery;
        if (table === 'categories') return categoryQuery;
        if (table === 'accounts') return accountsQuery;
        return { insert };
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never);

    const message: ExtractedMessage = {
      fromPhone: '+919876543210',
      rawPhone: '919876543210',
      messageId: 'wamid.cash.1',
      senderName: 'Shehzad',
      type: 'text',
      text: cashText,
      timestamp: '1792584000',
    };

    const result = await processIncomingWhatsAppMessage(message);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid-123',
        amount_paise: 8000,
        account_id: 'acc-cash',
      })
    );
    expect(result).toMatchObject({ status: 'recorded', transactionId: 'tx-cash-1' });
  });

  it('routes ATM cash withdrawal as a transfer from Bank to Cash account', async () => {
    vi.mocked(checkFastCommand).mockReturnValueOnce({
      intent: 'transaction',
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      transaction: {
        type: 'transfer',
        transfer_type: 'atm_withdrawal',
        amount_paise: 200000,
        category: 'Transfer',
        merchant: 'ATM Cash Withdrawal',
        note: 'ATM withdrawal: Online → Cash',
        occurred_at: '2026-10-21T12:00:00.000Z',
      },
    });

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'tx-atm-1' }, error: null }),
      }),
    });
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'user_settings') return verifiedUserQuery;
        if (table === 'categories') return categoryQuery;
        if (table === 'accounts') return accountsQuery;
        return { insert };
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never);

    const message: ExtractedMessage = {
      fromPhone: '+919876543210',
      rawPhone: '919876543210',
      messageId: 'wamid.atm.1',
      senderName: 'Shehzad',
      type: 'text',
      text: 'ATM withdrawal 2000',
      timestamp: '1792584000',
    };

    const result = await processIncomingWhatsAppMessage(message);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid-123',
        type: 'transfer',
        amount_paise: 200000,
        account_id: 'acc-bank',
        transfer_to_account_id: 'acc-cash',
      })
    );
    expect(result).toMatchObject({ status: 'recorded', transactionId: 'tx-atm-1' });
  });
});
