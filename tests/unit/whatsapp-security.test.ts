import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from '@/lib/whatsapp/security';

describe('WhatsApp Webhook Security (HMAC-SHA256)', () => {
  const secret = 'super_secret_app_key_12345';
  const rawBody = JSON.stringify({ object: 'whatsapp_business_account', test: true });

  it('validates a correct HMAC signature', () => {
    const validHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const header = `sha256=${validHash}`;

    const isValid = verifyWebhookSignature(rawBody, header, secret);
    expect(isValid).toBe(true);
  });

  it('rejects a tampered payload with valid header', () => {
    const validHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const header = `sha256=${validHash}`;

    // Tampered body
    const tamperedBody = JSON.stringify({ object: 'whatsapp_business_account', test: false });
    const isValid = verifyWebhookSignature(tamperedBody, header, secret);
    expect(isValid).toBe(false);
  });

  it('rejects an invalid signature hash', () => {
    const fakeHeader = 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const isValid = verifyWebhookSignature(rawBody, fakeHeader, secret);
    expect(isValid).toBe(false);
  });

  it('rejects missing or malformed header prefix', () => {
    expect(verifyWebhookSignature(rawBody, null, secret)).toBe(false);
    expect(verifyWebhookSignature(rawBody, '', secret)).toBe(false);
    expect(verifyWebhookSignature(rawBody, 'md5=abcdef123456', secret)).toBe(false);
  });
});
