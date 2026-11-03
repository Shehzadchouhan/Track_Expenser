import { getGeminiClient, getGeminiModel } from './client';
import { AIParseResult, AIParseResultSchema } from './types';
import { DEFAULT_CATEGORIES, APP_TIMEZONE } from '../constants';

const CATEGORY_NAMES = DEFAULT_CATEGORIES.map((c) => c.name).join(', ');

/**
 * Checks for immediate zero-latency bot commands (undo, help, yes/no, and instant transfer commands).
 */
export function checkFastCommand(text: string): AIParseResult | null {
  const normalized = text.trim().toLowerCase();

  // Undo command
  if (/^(undo|cancel|revert|delete(\s+last)?)$/i.test(normalized)) {
    return {
      intent: 'undo',
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      raw_message: text,
    };
  }

  // Help / Greeting
  if (/^(help|hi|hello|hey|\/help|\/start|menu|how to use)$/i.test(normalized)) {
    return {
      intent: 'help',
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      raw_message: text,
    };
  }

  // Clarification Confirmation (Yes)
  if (/^(yes|y|yeah|yup|confirm|correct|ha|haan)$/i.test(normalized)) {
    return {
      intent: 'clarification_response',
      confirmed: true,
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      raw_message: text,
    };
  }

  // Clarification Rejection (No)
  if (/^(no|n|nah|cancel|wrong|na|nahi)$/i.test(normalized)) {
    return {
      intent: 'clarification_response',
      confirmed: false,
      confidence: 1.0,
      clarification_needed: false,
      status: 'success',
      raw_message: text,
    };
  }

  // 1. ATM Cash Withdrawal (Online -> Cash transfer)
  const atmMatch =
    normalized.match(
      /(?:atm\s*withdrawal|withdrew|withdraw|atm\s*se\s*nikale|nikale\s*atm\s*se|atm\s*cash)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i
    ) ||
    normalized.match(
      /(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:from\s*atm|atm\s*withdrawal|atm\s*se|withdrawn\s*from\s*atm)/i
    );

  if (atmMatch && atmMatch[1]) {
    const amount = parseFloat(atmMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      return {
        intent: 'transaction',
        confidence: 1.0,
        clarification_needed: false,
        status: 'success',
        raw_message: text,
        transaction: {
          type: 'transfer',
          transfer_type: 'atm_withdrawal',
          payment_mode: 'cash',
          amount_paise: Math.round(amount * 100),
          category: 'Transfer',
          merchant: 'ATM Cash Withdrawal',
          note: 'ATM withdrawal: Online → Cash',
          occurred_at: new Date().toISOString(),
        },
      };
    }
  }

  // 2. Cash Deposit (Cash -> Online transfer)
  const depositMatch =
    normalized.match(
      /(?:cash\s*deposit|deposited|bank\s*me\s*jama|jama\s*kiye)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i
    ) ||
    normalized.match(
      /(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:cash\s*deposit|deposit\s*in\s*bank|bank\s*deposit)/i
    );

  if (depositMatch && depositMatch[1]) {
    const amount = parseFloat(depositMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      return {
        intent: 'transaction',
        confidence: 1.0,
        clarification_needed: false,
        status: 'success',
        raw_message: text,
        transaction: {
          type: 'transfer',
          transfer_type: 'cash_deposit',
          payment_mode: 'online',
          amount_paise: Math.round(amount * 100),
          category: 'Transfer',
          merchant: 'Cash Deposit to Bank',
          note: 'Cash deposit: Cash → Online',
          occurred_at: new Date().toISOString(),
        },
      };
    }
  }

  // 3. Move money to savings (Online -> Savings transfer)
  const savingsMatch =
    normalized.match(
      /(?:saved|save|moved\s*to\s*savings|savings\s*deposit|bachat)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i
    ) ||
    normalized.match(
      /(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:saved|to\s*savings|in\s*vault|bachat)/i
    );

  if (savingsMatch && savingsMatch[1]) {
    const amount = parseFloat(savingsMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      return {
        intent: 'transaction',
        confidence: 1.0,
        clarification_needed: false,
        status: 'success',
        raw_message: text,
        transaction: {
          type: 'transfer',
          transfer_type: 'to_savings',
          amount_paise: Math.round(amount * 100),
          category: 'Transfer',
          merchant: 'Savings Vault Deposit',
          note: 'Savings deposit: Online → Savings Vault',
          occurred_at: new Date().toISOString(),
        },
      };
    }
  }

  return null;
}

/**
 * Parses natural language expense/income texts into structured transactions via Gemini.
 */
export async function parseTextTransaction(
  text: string,
  now: Date = new Date()
): Promise<AIParseResult> {
  // 1. Check for instant commands
  const fast = checkFastCommand(text);
  if (fast) {
    return fast;
  }

  const ai = getGeminiClient();
  const primaryModel = getGeminiModel();
  const dateStr = now.toISOString();

  const prompt = `
You are a financial transaction assistant for an expense tracker in India.
Current reference timestamp: ${dateStr} (Timezone: ${APP_TIMEZONE}).

Supported Standard Categories:
${CATEGORY_NAMES}

Your job:
Extract financial details from this user message: "${text}"

RULES:
1. Amount MUST be converted to integer paise (1 Rupee = 100 paise).
   - ₹250 -> 25000 paise
   - ₹70.00 -> 7000 paise
   - "250 on tea" -> 25000 paise
   - "Uber ride to office in 250" -> 25000 paise
2. Determine transaction type:
   - "expense" (default, debited, paid, spent, bought)
   - "income" (salary, freelance, received money, credited)
   - "transfer" (ATM withdrawal, deposited cash in bank, moving money to savings)
3. Determine payment mode:
   - "cash" if user mentions cash, rokar, rokad, nagad, नकद, or physical notes
   - "online" (default for UPI, GPay, PhonePe, Paytm, card, netbanking, or unstated)
4. Identify merchant / payee / sender (e.g. Starbucks, Zudio, Swiggy, Uber, Jio, HPCL Petrol, Saurav, Dad). If unknown, leave null.
5. Pick the closest standard category. If uncertain, use "Other Expense" or "Other Income". For transfers, use "Transfer".
6. Confidence & Clarification:
   - If the message mentions a clear monetary amount and context, intent MUST be "transaction", confidence >= 0.9, clarification_needed = false.
   - If ambiguous (e.g. just a lone number like "450" with zero context): confidence < 0.7, clarification_needed = true, clarification_prompt = "Did you mean ₹450 as an expense? Reply YES to confirm."
7. If completely non-financial (e.g. "how is the weather?"): set intent = "unknown", confidence = 0, transaction = null, status = "ignored".

Return valid JSON with this exact shape:
{
  "intent": "transaction" | "unknown",
  "confidence": number,
  "clarification_needed": boolean,
  "clarification_prompt": string | null,
  "status": "success" | "ignored",
  "transaction": {
    "type": "expense" | "income" | "transfer",
    "payment_mode": "online" | "cash",
    "transfer_type": "atm_withdrawal" | "cash_deposit" | "to_savings" | null,
    "amount_paise": number,
    "category": string,
    "merchant": string | null,
    "note": string | null,
    "occurred_at": string
  } | null
}
`;

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

  const candidateModels = [
    primaryModel,
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  // Function to run inference on a specific model
  const runModel = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const jsonStr = extractJsonBlock(rawJson);
    const parsed = JSON.parse(jsonStr);

    return AIParseResultSchema.parse({
      ...parsed,
      raw_message: text,
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
      return await runModel(model);
    } catch (err) {
      console.warn(`[AI Text Parser] Model ${model} failed:`, err);
      lastError = err;
    }
  }

  console.error('[AI Text Parser] All candidate models failed. Last error:', lastError);
  return {
    intent: 'unknown',
    confidence: 0,
    clarification_needed: false,
    status: 'unreadable',
    raw_message: text,
  };
}
