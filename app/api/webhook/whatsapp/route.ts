import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/whatsapp/security';
import { extractIncomingMessage } from '@/lib/whatsapp/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { processIncomingWhatsAppMessage } from '@/lib/bot/processor';

/**
 * Meta WhatsApp Cloud API Webhook
 * 
 * GET: Webhook verification challenge during Meta setup.
 * POST: Incoming messages, delivery receipts, and status updates.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const configuredVerifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || 'track_expenser_verify_token_2026').trim();

  // Verification challenge from Meta Developer Portal
  if (mode === 'subscribe' && token === configuredVerifyToken && challenge) {
    console.log('[WhatsApp Webhook] Handshake verified successfully.');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[WhatsApp Webhook] Unauthorized verification challenge attempt.');
  return new Response('Forbidden', { status: 403 });
}

// In-memory fast cache to instantly deduplicate Meta webhook retries and prevent looping replies
const inFlightOrProcessedMessages = new Map<string, number>();

function cleanOldMessageIds() {
  const now = Date.now();
  for (const [id, time] of inFlightOrProcessedMessages.entries()) {
    if (now - time > 15 * 60 * 1000) {
      inFlightOrProcessedMessages.delete(id);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-hub-signature-256');

    // 1. Strict HMAC-SHA256 signature verification
    const isSignatureValid = verifyWebhookSignature(rawBody, signatureHeader);
    if (!isSignatureValid) {
      console.warn('[WhatsApp Webhook] Invalid X-Hub-Signature-256 signature.');
      return new Response('Unauthorized: Invalid Signature', { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('Bad Request: Invalid JSON', { status: 400 });
    }

    // 2. Extract normalized message (or ignore delivery receipts)
    const incomingMsg = extractIncomingMessage(payload);
    if (!incomingMsg) {
      // Ignored: Delivery status receipt (sent/delivered/read) or system event
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // 3. Fast In-Memory Deduplication (Stops Meta retries from triggering duplicate bot replies)
    cleanOldMessageIds();
    if (inFlightOrProcessedMessages.has(incomingMsg.messageId)) {
      console.log(`[WhatsApp Webhook] Duplicate/retry message ${incomingMsg.messageId} suppressed.`);
      return NextResponse.json(
        { status: 'duplicate_ignored', messageId: incomingMsg.messageId },
        { status: 200 }
      );
    }
    inFlightOrProcessedMessages.set(incomingMsg.messageId, Date.now());

    // 4. Database Idempotency Check
    try {
      const supabase = createAdminClient();
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('whatsapp_message_id', incomingMsg.messageId)
        .maybeSingle();

      if (existing) {
        console.log(`[WhatsApp Webhook] Duplicate transaction ${incomingMsg.messageId} ignored.`);
        return NextResponse.json(
          { status: 'duplicate_ignored', messageId: incomingMsg.messageId },
          { status: 200 }
        );
      }
    } catch (dbError) {
      console.warn('[WhatsApp Webhook] Database check skipped or failed:', dbError);
    }

    console.log(`[WhatsApp Webhook] Valid message received from ${incomingMsg.fromPhone} (type: ${incomingMsg.type})`);

    // 4. Process Message End-to-End
    const processResult = await processIncomingWhatsAppMessage(incomingMsg);

    return NextResponse.json(
      {
        status: 'ok',
        processResult,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[WhatsApp Webhook] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
