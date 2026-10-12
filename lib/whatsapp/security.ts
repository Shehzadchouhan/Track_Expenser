import crypto from 'crypto';

/**
 * Validates the X-Hub-Signature-256 header sent by Meta on incoming webhooks.
 * Uses timingSafeEqual to guard against timing attacks.
 *
 * @param rawBody - The unparsed raw string of the HTTP request body.
 * @param signatureHeader - The content of the 'x-hub-signature-256' header (e.g. 'sha256=abcdef123...').
 * @param appSecret - Optional secret override (defaults to process.env.WHATSAPP_APP_SECRET).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined = process.env.WHATSAPP_APP_SECRET
): boolean {
  // If app secret is not configured
  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET is not set; skipping HMAC verification.');
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const clientSignature = parts[1];
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Ensure buffers have matching lengths before timingSafeEqual
  if (clientSignature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(clientSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}
