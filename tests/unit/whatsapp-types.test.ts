import { describe, it, expect } from 'vitest';
import { extractIncomingMessage } from '@/lib/whatsapp/types';

describe('WhatsApp Payload Extractor', () => {
  it('extracts text messages accurately', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550269870',
                  phone_number_id: '987654321',
                },
                contacts: [
                  {
                    profile: { name: 'Shehzad' },
                    wa_id: '919876543210',
                  },
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ1RDk1QTE5Qzg5Mjg5OTQA',
                    timestamp: '1728550000',
                    type: 'text',
                    text: { body: 'Spent 450 on fuel' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const extracted = extractIncomingMessage(payload);
    expect(extracted).not.toBeNull();
    expect(extracted?.fromPhone).toBe('+919876543210');
    expect(extracted?.rawPhone).toBe('919876543210');
    expect(extracted?.type).toBe('text');
    expect(extracted?.text).toBe('Spent 450 on fuel');
    expect(extracted?.messageId).toBe('wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ1RDk1QTE5Qzg5Mjg5OTQA');
    expect(extracted?.senderName).toBe('Shehzad');
  });

  it('extracts image message attachments with mediaId', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550269870',
                  phone_number_id: '987654321',
                },
                contacts: [{ profile: { name: 'Shehzad' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.IMAGE123',
                    timestamp: '1728550000',
                    type: 'image',
                    image: {
                      id: 'media_id_999888',
                      mime_type: 'image/jpeg',
                      caption: 'paid for dinner',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const extracted = extractIncomingMessage(payload);
    expect(extracted).not.toBeNull();
    expect(extracted?.type).toBe('image');
    expect(extracted?.mediaId).toBe('media_id_999888');
    expect(extracted?.text).toBe('paid for dinner');
  });

  it('extracts document attachments (e.g. PDF statement)', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550269870',
                  phone_number_id: '987654321',
                },
                contacts: [{ profile: { name: 'Shehzad' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.DOC123',
                    timestamp: '1728550000',
                    type: 'document',
                    document: {
                      id: 'doc_id_555444',
                      mime_type: 'application/pdf',
                      filename: 'bank_statement_october.pdf',
                      caption: 'bank statement for October',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const extracted = extractIncomingMessage(payload);
    expect(extracted).not.toBeNull();
    expect(extracted?.type).toBe('document');
    expect(extracted?.mediaId).toBe('doc_id_555444');
    expect(extracted?.mimeType).toBe('application/pdf');
    expect(extracted?.filename).toBe('bank_statement_october.pdf');
    expect(extracted?.text).toBe('bank statement for October');
  });

  it('ignores delivery status updates (read, delivered, sent)', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550269870', phone_number_id: '987654321' },
                statuses: [
                  {
                    id: 'wamid.HBgMOTE5ODc2NTQzMjEw',
                    status: 'read',
                    timestamp: '1728550010',
                    recipient_id: '919876543210',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const extracted = extractIncomingMessage(payload);
    expect(extracted).toBeNull();
  });

  it('returns null on invalid or non-whatsapp payload', () => {
    expect(extractIncomingMessage(null)).toBeNull();
    expect(extractIncomingMessage({})).toBeNull();
    expect(extractIncomingMessage({ object: 'page' })).toBeNull();
  });
});
