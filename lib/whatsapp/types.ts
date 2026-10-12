/**
 * Meta WhatsApp Cloud API Types & Payload Extractor
 */

export interface MetaMessageText {
  body: string;
}

export interface MetaMessageImage {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface MetaMessageDocument {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface MetaIncomingMessage {
  from: string; // e.g. "919876543210"
  id: string;   // e.g. "wamid.HBgMOTE5ODc2NTQz..."
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'interactive' | 'button' | 'unknown';
  text?: MetaMessageText;
  image?: MetaMessageImage;
  document?: MetaMessageDocument;
}

export interface MetaWebhookChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  messages?: MetaIncomingMessage[];
  statuses?: Array<{
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
  }>;
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: MetaWebhookChangeValue;
      field: 'messages';
    }>;
  }>;
}

export interface ExtractedMessage {
  fromPhone: string; // Formatted with leading '+', e.g. "+919876543210"
  rawPhone: string;  // e.g. "919876543210"
  messageId: string;
  senderName: string;
  type: 'text' | 'image' | 'document' | 'unsupported';
  text?: string;
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  timestamp: string;
}

/**
 * Extracts normalized message data from a Meta WhatsApp Cloud API webhook payload.
 * Returns null if the payload is a delivery status receipt (sent/delivered/read) or empty.
 */
export function extractIncomingMessage(payload: unknown): ExtractedMessage | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as MetaWebhookPayload;
  if (p.object !== 'whatsapp_business_account' || !Array.isArray(p.entry)) {
    return null;
  }

  for (const entry of p.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      const val = change.value;
      if (!val || val.messaging_product !== 'whatsapp') continue;

      // Ignore delivery receipts/statuses
      if (!Array.isArray(val.messages) || val.messages.length === 0) {
        continue;
      }

      const msg = val.messages[0];
      const contact = val.contacts?.[0];
      const rawPhone = msg.from.replace(/\D/g, '');
      const fromPhone = `+${rawPhone}`;

      if (msg.type === 'text' && msg.text?.body) {
        return {
          fromPhone,
          rawPhone,
          messageId: msg.id,
          senderName: contact?.profile?.name || 'User',
          type: 'text',
          text: msg.text.body.trim(),
          timestamp: msg.timestamp,
        };
      }

      if (msg.type === 'image' && msg.image?.id) {
        return {
          fromPhone,
          rawPhone,
          messageId: msg.id,
          senderName: contact?.profile?.name || 'User',
          type: 'image',
          mediaId: msg.image.id,
          mimeType: msg.image.mime_type || 'image/jpeg',
          text: msg.image.caption?.trim(),
          timestamp: msg.timestamp,
        };
      }

      if (msg.type === 'document' && msg.document?.id) {
        return {
          fromPhone,
          rawPhone,
          messageId: msg.id,
          senderName: contact?.profile?.name || 'User',
          type: 'document',
          mediaId: msg.document.id,
          mimeType: msg.document.mime_type || 'application/pdf',
          filename: msg.document.filename,
          text: msg.document.caption?.trim() || msg.document.filename,
          timestamp: msg.timestamp,
        };
      }

      return {
        fromPhone,
        rawPhone,
        messageId: msg.id,
        senderName: contact?.profile?.name || 'User',
        type: 'unsupported',
        timestamp: msg.timestamp,
      };
    }
  }

  return null;
}
