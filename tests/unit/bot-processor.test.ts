import { describe, it, expect, vi } from 'vitest';
import { processIncomingWhatsAppMessage } from '@/lib/bot/processor';
import { ExtractedMessage } from '@/lib/whatsapp/types';

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
    } as any);

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
    } as any);

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
});
