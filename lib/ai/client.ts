import { GoogleGenAI } from '@google/genai';

/**
 * Returns a configured GoogleGenAI instance.
 * Throws a clear error if GEMINI_API_KEY is missing.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing environment variable: GEMINI_API_KEY');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Returns the Gemini model configured in environment variables,
 * defaulting to 'gemini-3.5-flash'.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
