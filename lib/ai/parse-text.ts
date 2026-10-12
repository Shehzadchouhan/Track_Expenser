import { getGeminiClient, getGeminiModel } from './client';
import { AIParseResult, AIParseResultSchema } from './types';
import { DEFAULT_CATEGORIES, APP_TIMEZONE } from '../constants';

const CATEGORY_NAMES = DEFAULT_CATEGORIES.map((c) => c.name).join(', ');

/**
 * Checks for immediate zero-latency bot commands (undo, help, yes/no).
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
  const fallbackModel = primaryModel === 'gemini-3.5-flash' ? 'gemini-3.8-flash' : 'gemini-3.5-flash';
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
2. Determine if it is "expense" (default, debited, paid, spent) or "income" (e.g. salary, freelance, received money, credited, received from X).
   - "Received ₹70 from Mr Saurav via Paytm" -> type: "income", amount: 7000 paise, merchant: "Mr Saurav", note: "Received via Paytm", category: "Other Income"
   - "Uber ride to office in 250" -> type: "expense", amount: 25000 paise, merchant: "Uber", note: "Ride to office", category: "Transportation"
   - "Dear SBI User, A/C 1234 debited by Rs 450.00 on 12-Oct-26 by transfer to SWIGGY. Ref No 123456" -> type: "expense", amount: 45000 paise, merchant: "SWIGGY", note: "Transfer to SWIGGY", category: "Food & Dining"
   - "HDFC Bank: Rs 1,500.00 debited from a/c **4321 to RELIANCE RETAIL" -> type: "expense", amount: 150000 paise, merchant: "RELIANCE RETAIL", category: "Shopping"
   - "ICICI Bank: Acct XX123 credited with Rs 25,000.00 on 12-Oct-26. Info: NEFT-SALARY" -> type: "income", amount: 2500000 paise, merchant: null, note: "NEFT-SALARY", category: "Salary"
3. Identify merchant / payee / sender (e.g. Starbucks, Zudio, Swiggy, Uber, Jio, HPCL Petrol, Saurav, Dad). If unknown, leave null.
4. Pick the closest standard category. If uncertain, use "Other Expense" or "Other Income".
5. Confidence & Clarification:
   - If the message mentions a clear monetary amount and context, or is a bank debit/credit transaction SMS/statement, intent MUST be "transaction", confidence MUST be >= 0.9, clarification_needed MUST be false.
   - If ambiguous (e.g. just a lone number like "450" with zero context): confidence < 0.7, clarification_needed = true, clarification_prompt = "Did you mean ₹450 as an expense? Reply YES to confirm."
6. If the message is completely non-financial (e.g. "how is the weather?"): set intent = "unknown", confidence = 0, transaction = null, status = "ignored".

Return valid JSON with this exact shape:
{
  "intent": "transaction" | "unknown",
  "confidence": number,
  "clarification_needed": boolean,
  "clarification_prompt": string | null,
  "status": "success" | "ignored",
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
