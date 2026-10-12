import { ExtractedMessage } from '../whatsapp/types';
import { whatsappClient } from '../whatsapp/client';
import { createAdminClient } from '../supabase/admin';
import { checkFastCommand, parseTextTransaction } from '../ai/parse-text';
import { parseImageTransaction } from '../ai/parse-image';
import { formatINR } from '../money';
import { APP_TIMEZONE } from '../constants';

export interface BotProcessResult {
  status:
    | 'unlinked_user'
    | 'undone'
    | 'no_tx_to_undo'
    | 'help'
    | 'media_error'
    | 'failed_payment'
    | 'clarification_sent'
    | 'ignored'
    | 'recorded';
  messageId?: string;
  transactionId?: string;
}

/**
 * End-to-end incoming WhatsApp message processor.
 * 1. Checks user authorization via verified phone.
 * 2. Handles fast commands (undo, help).
 * 3. Runs AI text/multimodal image extraction.
 * 4. Inserts into Supabase with idempotency.
 * 5. Calculates Safe-to-Spend daily pulse and sends WhatsApp confirmation.
 */
export async function processIncomingWhatsAppMessage(
  msg: ExtractedMessage
): Promise<BotProcessResult> {
  const supabase = createAdminClient();

  // 1. Verify User Phone Link
  const { data: userSettings, error: userError } = await supabase
    .from('user_settings')
    .select('user_id, phone_number, phone_verified, timezone, monthly_budget_paise')
    .eq('phone_number', msg.fromPhone)
    .eq('phone_verified', true)
    .maybeSingle();

  if (userError || !userSettings) {
    console.log(`[WhatsApp Bot] Unverified number received: ${msg.fromPhone}`);
    await whatsappClient.sendTextMessage(
      msg.fromPhone,
      `👋 *Hello from Track Expenser!*\n\nYour WhatsApp number (*${msg.fromPhone}*) is not yet linked to an account.\n\n*To start tracking:*\n1. Log in to your Track Expenser web dashboard.\n2. Go to *Settings → Link WhatsApp*.\n3. Enter this phone number to receive a 6-digit verification code.`
    );
    return { status: 'unlinked_user' };
  }

  const userId = userSettings.user_id;
  const userTz = userSettings.timezone || APP_TIMEZONE;

  // 2. Handle Fast Commands
  if (msg.type === 'text' && msg.text) {
    const fast = checkFastCommand(msg.text);

    if (fast?.intent === 'undo') {
      // Find the user's latest transaction
      const { data: latestTx } = await supabase
        .from('transactions')
        .select('id, amount_paise, merchant, type, note')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestTx) {
        await whatsappClient.sendTextMessage(
          msg.fromPhone,
          'ℹ️ No recent transactions found to undo.'
        );
        return { status: 'no_tx_to_undo' };
      }

      // Delete the transaction
      await supabase.from('transactions').delete().eq('id', latestTx.id);

      const formattedAmount = formatINR(latestTx.amount_paise, { showPaise: false });
      const label = latestTx.merchant || latestTx.note || latestTx.type;

      await whatsappClient.sendTextMessage(
        msg.fromPhone,
        `↩️ *Undone!*\nSuccessfully removed *${formattedAmount}* (${label}).`
      );

      return { status: 'undone', transactionId: latestTx.id };
    }

    if (fast?.intent === 'help') {
      await whatsappClient.sendTextMessage(
        msg.fromPhone,
        `💡 *Track Expenser WhatsApp Guide*\n\nSend expenses naturally or share payment screenshots:\n• _"Spent 250 on lunch"_\n• _"Paid 1200 at Zudio via UPI"_\n• _"Received 5000 freelance"_\n• Share any GPay / PhonePe / Paytm payment screenshot\n\n*Commands:*\n• *undo* : Revert your last logged expense\n• *help* : Show this guide`
      );
      return { status: 'help' };
    }
  }

  // 3. AI Extraction (Text, Image, or Document Statement)
  let aiResult;

  if ((msg.type === 'image' || msg.type === 'document') && msg.mediaId) {
    const isDoc = msg.type === 'document';
    const mime = (msg.mimeType || '').toLowerCase();
    const isSupportedMime = mime.startsWith('image/') || mime === 'application/pdf' || mime === 'application/octet-stream';

    if (!isSupportedMime) {
      await whatsappClient.sendTextMessage(
        msg.fromPhone,
        '⚠️ Unsupported file format. Please send your payment screenshot or statement as an image (JPEG/PNG) or PDF document.'
      );
      return { status: 'media_error' };
    }

    const media = await whatsappClient.downloadMediaAsBase64(msg.mediaId);
    if (!media) {
      await whatsappClient.sendTextMessage(
        msg.fromPhone,
        `⚠️ Could not download the ${isDoc ? 'document' : 'image'} attachment. Please try sending it again.`
      );
      return { status: 'media_error' };
    }

    aiResult = await parseImageTransaction({
      base64Data: media.base64,
      mimeType: media.mimeType || msg.mimeType,
      caption: msg.text,
    });
  } else if (msg.type === 'text' && msg.text) {
    aiResult = await parseTextTransaction(msg.text);
  } else {
    return { status: 'ignored' };
  }

  // 4. Handle Special AI Outcomes
  if (aiResult.status === 'failed_payment') {
    await whatsappClient.sendTextMessage(
      msg.fromPhone,
      '⚠️ *Payment Not Logged*\nThis screenshot shows the payment failed or was declined.'
    );
    return { status: 'failed_payment' };
  }

  if (aiResult.clarification_needed && aiResult.clarification_prompt) {
    await whatsappClient.sendTextMessage(msg.fromPhone, aiResult.clarification_prompt);
    return { status: 'clarification_sent' };
  }

  if (aiResult.intent !== 'transaction' || !aiResult.transaction) {
    await whatsappClient.sendTextMessage(
      msg.fromPhone,
      `🤔 I couldn't detect an expense or income in that message.\n\nTry sending something like:\n• _"Spent 350 on petrol"_\n• Or share a payment confirmation screenshot / bank statement!`
    );
    return { status: 'ignored' };
  }

  // 5. Match Category
  const { data: userCategories } = await supabase
    .from('categories')
    .select('id, name, kind')
    .eq('user_id', userId);

  const targetCategory = (userCategories || []).find(
    (c) => c.name.toLowerCase() === aiResult.transaction?.category.toLowerCase()
  ) || (userCategories || []).find(
    (c) => c.kind === aiResult.transaction?.type
  );

  // 6. Insert Transaction
  const occurredAt = aiResult.transaction.occurred_at || new Date().toISOString();
  const rawLabel = msg.type === 'text' ? msg.text || null : msg.type === 'document' ? `[Document: ${msg.filename || 'Statement'}]` : '[Screenshot]';

  const { data: insertedTx, error: insertError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: aiResult.transaction.type,
      amount_paise: aiResult.transaction.amount_paise,
      category_id: targetCategory?.id || null,
      merchant: aiResult.transaction.merchant || null,
      note: aiResult.transaction.note || null,
      source: msg.type === 'text' ? 'whatsapp_text' : 'whatsapp_image',
      whatsapp_message_id: msg.messageId,
      raw_input: rawLabel,
      occurred_at: occurredAt,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[WhatsApp Bot] Insert transaction error:', insertError);
    await whatsappClient.sendTextMessage(
      msg.fromPhone,
      '⚠️ An error occurred while saving your transaction. Please try again.'
    );
    return { status: 'ignored' };
  }

  // 7. Calculate Safe-to-Spend Budget Pulse
  let pulseText = '';
  try {
    const { data: pulseData } = await supabase.rpc('get_daily_budget_pulse', {
      p_user_id: userId,
      p_timezone: userTz,
    });

    const pulse = pulseData?.[0];
    if (pulse && pulse.monthly_budget_paise > 0) {
      const safeToday = formatINR(pulse.remaining_today_paise, { showPaise: false });
      const spentToday = formatINR(pulse.spent_today_paise, { showPaise: false });
      const monthSpent = formatINR(pulse.month_spent_paise, { showPaise: false });
      const monthBudget = formatINR(pulse.monthly_budget_paise, { showPaise: false });

      pulseText = `\n\n💡 *Budget Pulse:*\n• Spent Today: *${spentToday}*\n• Safe to Spend Today: *${safeToday}* remaining\n• Month: *${monthSpent}* / *${monthBudget}*`;
      if (pulse.is_over_budget) {
        pulseText += '\n⚠️ _Monthly budget limit reached!_';
      }
    } else {
      pulseText = '\n\n💡 _Tip: Set a monthly budget in your web dashboard to see your daily Safe-to-Spend allowance!_';
    }
  } catch (pulseErr) {
    console.warn('[WhatsApp Bot] Could not fetch budget pulse:', pulseErr);
  }

  // 8. Send WhatsApp Confirmation
  const amountFormatted = formatINR(aiResult.transaction.amount_paise, { showPaise: false });
  const categoryName = targetCategory?.name || aiResult.transaction.category;
  const merchantLabel = aiResult.transaction.merchant ? ` (${aiResult.transaction.merchant})` : '';
  const typeIcon = aiResult.transaction.type === 'income' ? '💰' : '✅';
  const typeLabel = aiResult.transaction.type === 'income' ? 'Income Logged' : 'Recorded';

  const reply = `${typeIcon} *${typeLabel}: ${amountFormatted}*\n🏷️ *Category:* ${categoryName}${merchantLabel}${pulseText}`;

  await whatsappClient.sendTextMessage(msg.fromPhone, reply);

  return {
    status: 'recorded',
    transactionId: insertedTx?.id,
    messageId: msg.messageId,
  };
}
