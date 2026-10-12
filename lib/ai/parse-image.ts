import { getGeminiClient, getGeminiModel } from './client';
import { AIParseResult, AIParseResultSchema } from './types';
import { DEFAULT_CATEGORIES, APP_TIMEZONE } from '../constants';

const CATEGORY_NAMES = DEFAULT_CATEGORIES.map((c) => c.name).join(', ');

export interface ImageParseOptions {
  base64Data: string;
  mimeType?: string;
  caption?: string;
  now?: Date;
}

function extractJsonBlock(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Parses payment confirmation screenshots (GPay, PhonePe, Paytm, CRED) or paper receipts using Gemini Vision.
 */
export async function parseImageTransaction({
  base64Data,
  mimeType = 'image/jpeg',
  caption,
  now = new Date(),
}: ImageParseOptions): Promise<AIParseResult> {
  const ai = getGeminiClient();
  const primaryModel = getGeminiModel();
  const dateStr = now.toISOString();

  const candidateModels = [
    primaryModel,
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  const prompt = `
You are a financial receipt, bank statement, and payment screenshot analyzer for an expense tracker in India.
Current reference timestamp: ${dateStr} (Timezone: ${APP_TIMEZONE}).
${caption ? `User provided message caption: "${caption}"\n` : ''}

Supported Standard Categories:
${CATEGORY_NAMES}

Your job:
Analyze this image or document (which could be a payment confirmation screen, bank account statement, transaction slip, receipt, or invoice from Google Pay, PhonePe, Paytm, CRED, Amazon Pay, BHIM, Bank UPI, SBI, HDFC, ICICI, Axis, or physical store bill).

INSTRUCTIONS:
1. Transaction Status & Direction:
   - If the payment says "Paid", "Paid to", "Sent", "Transfer Completed", "Payment Successful", "Bill Paid", "Debit": type = "expense", status = "success".
   - If the screen says "Received", "Money Received", "Payment received from", "Credited", "Cashback": type = "income", status = "success".
   - If the payment says "Failed", "Declined", "Cancelled", "Payment Failed": status = "failed_payment", transaction = null, clarification_prompt = "⚠️ Payment shows as failed or declined. Not logging."
   - If this is a random photo, selfie, meme, or not a receipt/payment: status = "unreadable", intent = "unknown", transaction = null.
2. Financial Extraction:
   - Amount: Look for the paid or received amount (e.g. ₹350, ₹70.00, ₹1,200). Convert strictly to integer paise (1 INR = 100 paise). Example: ₹250 -> 25000 paise, ₹70.00 -> 7000 paise.
   - Merchant / Payee / Sender: Look for the recipient or sender name, UPI ID, or store/brand name (e.g. "Swiggy", "Starbucks", "HPCL Petrol", "Sharma Kirana", "Saurav", "Zudio", "Uber").
   - Category: Map accurately to one of the Supported Standard Categories. If ambiguous, default to "Other Expense" or "Shopping".
   - Note: Include transaction note, reference ID, or UTR if visible.
   - Occurred At: If date/time is visible, output as ISO string (e.g. "${dateStr}"). Otherwise output "${dateStr}".
3. Confidence:
   - High confidence (>= 0.85) if amount and status are visible. Set clarification_needed = false, intent = "transaction".
   - Low confidence (< 0.7) only if blurry or cut off.

Return valid JSON with this exact shape:
{
  "intent": "transaction" | "unknown",
  "confidence": number,
  "clarification_needed": boolean,
  "clarification_prompt": string | null,
  "status": "success" | "failed_payment" | "unreadable",
  "transaction": {
    "type": "expense" | "income",
    "amount_paise": number,
    "category": string,
    "merchant": string | null,
    "note": string | null,
    "occurred_at": string
  } | null
}
`;

  const runModel = async (modelName: string) => {
    console.log(`[AI Image Parser] Calling Gemini Vision model: ${modelName}`);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawJson = response.text?.trim() || '{}';
    console.log(`[AI Image Parser] Raw output from ${modelName}:`, rawJson);
    const jsonStr = extractJsonBlock(rawJson);
    const parsed = JSON.parse(jsonStr);

    return AIParseResultSchema.parse({
      ...parsed,
      raw_message: caption ? `[Screenshot: ${caption}]` : '[Image Screenshot]',
      transaction: parsed.transaction
        ? {
            ...parsed.transaction,
            occurred_at: parsed.transaction.occurred_at || dateStr,
          }
        : null,
    });
  };

  let lastError: unknown = null;
  for (const model of candidateModels) {
    try {
      const result = await runModel(model);
      console.log(`[AI Image Parser] Success with model ${model}`);
      return result;
    } catch (err) {
      console.warn(`[AI Image Parser] Model ${model} failed:`, err);
      lastError = err;
    }
  }

  console.error('[AI Image Parser] All candidate models failed. Last error:', lastError);
  return {
    intent: 'unknown',
    confidence: 0,
    clarification_needed: false,
    status: 'unreadable',
    raw_message: caption ? `[Screenshot: ${caption}]` : '[Image Screenshot]',
  };
}
