'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Mic, PlusCircle, X } from 'lucide-react';
import Image from 'next/image';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { categoryLabel, type AppLanguage } from '@/lib/i18n';

interface SpeechRecognitionResult extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionError extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResult) => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'expense' | 'income';
  isAuthenticated: boolean;
  language: AppLanguage;
  onSubmit: (data: {
    type: 'expense' | 'income';
    amountRupees: number;
    category: string;
    merchant?: string;
    note?: string;
    occurredAt?: string;
  }) => Promise<void>;
}

function extractSpokenAmount(transcript: string): string | null {
  const normalized = transcript
    .replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)));
  const match = normalized.match(/(?:₹|rs\.?|rupees?|inr|रुपये?|रुपया|रु\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;

  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? String(amount) : null;
}

function extractDescription(transcript: string): string {
  return transcript
    .replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
    .replace(/(?:₹|rs\.?|rupees?|inr|रुपये?|रुपया|रु\.?)?\s*[\d,]+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\b(spent|spend|paid|pay|on|at|for|rupees?)\b/gi, ' ')
    .replace(/\b(kharch|kharcha|kharch kiya|rupaye|rupya|mein|par)\b/gi, ' ')
    .replace(/(खर्च|किया|रुपये|रुपया|में|पर|का|की|के)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function AddTransactionModal({
  isOpen,
  onClose,
  initialType = 'expense',
  isAuthenticated,
  language,
  onSubmit,
}: AddTransactionModalProps) {
  const [type, setType] = useState<'expense' | 'income'>(initialType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(initialType === 'income' ? 'Salary' : 'Food & Dining');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [occurredAt, setOccurredAt] = useState<string | undefined>();
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const isHindi = language === 'hi';
  const handleClose = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = null;
    setImagePreviewUrl(null);
    setOccurredAt(undefined);
    setScanConfidence(null);
    onClose();
  };

  const handleScanImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size === 0 || file.size > 6 * 1024 * 1024) {
      setError(isHindi ? 'तस्वीर 6 MB से छोटी होनी चाहिए।' : 'Choose an image smaller than 6 MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(isHindi ? 'JPG, PNG या WebP तस्वीर चुनें।' : 'Choose a JPG, PNG, or WebP image.');
      return;
    }

    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = URL.createObjectURL(file);
    setImagePreviewUrl(imagePreviewUrlRef.current);
    setError(null);
    setIsScanning(true);
    setAmount('');
    setMerchant('');
    setNote('');
    setScanConfidence(null);
    setOccurredAt(undefined);

    try {
      const formData = new FormData();
      formData.set('image', file);
      const response = await fetch('/api/transactions/parse-image', {
        method: 'POST',
        body: formData,
      });
      const result: {
        error?: string;
        transaction?: {
          type: 'expense' | 'income';
          amount_paise: number;
          category: string;
          merchant?: string | null;
          note?: string | null;
          occurred_at?: string;
          confidence: number;
        };
      } = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Could not scan this image.');
      }

      const extracted = result.transaction;
      if (
        !extracted ||
        !Number.isFinite(extracted.amount_paise) ||
        extracted.amount_paise <= 0 ||
        !['expense', 'income'].includes(extracted.type)
      ) {
        throw new Error(isHindi ? 'तस्वीर में लेन-देन नहीं मिला।' : 'No valid transaction was found in this image.');
      }
      const matchedCategory = DEFAULT_CATEGORIES.find(
        (item) =>
          item.name.toLowerCase() === String(extracted.category).toLowerCase() &&
          item.kind === extracted.type
      );
      setType(extracted.type);
      setCategory(
        matchedCategory?.name ??
          (extracted.type === 'income' ? 'Other Income' : 'Other Expense')
      );
      setAmount((extracted.amount_paise / 100).toFixed(2).replace(/\.00$/, ''));
      setMerchant(extracted.merchant || '');
      setNote(extracted.note || '');
      setOccurredAt(extracted.occurred_at);
      setScanConfidence(extracted.confidence);
      setShowDetails(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi
            ? 'तस्वीर पढ़ी नहीं जा सकी। कृपया फिर कोशिश करें।'
            : 'Could not read this image. Please try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const startVoiceEntry = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionApi =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setError(
        isHindi
          ? 'इस ब्राउज़र में आवाज़ से लिखने की सुविधा नहीं है। कृपया रकम टाइप करें।'
          : 'Voice entry is not available in this browser. Please type the amount.'
      );
      return;
    }

    setError(null);
    const recognition = new SpeechRecognitionApi();
    recognition.lang = isHindi ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        setError(isHindi ? 'आवाज़ समझ नहीं आई। फिर से कोशिश करें।' : 'I could not hear that. Please try again.');
        return;
      }

      const spokenAmount = extractSpokenAmount(transcript);
      const description = extractDescription(transcript);
      if (spokenAmount) setAmount(spokenAmount);
      if (description) setMerchant(description);

      if (!spokenAmount) {
        setError(
          isHindi
            ? 'खर्च की रकम साफ़ नहीं सुनाई दी। रकम टाइप करें और फिर सेव करें।'
            : 'I could not catch the amount. Type it in, then save your record.'
        );
      }
    };
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? isHindi
            ? 'आवाज़ इस्तेमाल करने के लिए माइक्रोफ़ोन की अनुमति दें।'
            : 'Allow microphone access to use voice entry.'
          : isHindi
            ? 'आवाज़ रिकॉर्ड नहीं हो पाई। कृपया फिर से कोशिश करें।'
            : 'Voice entry did not work. Please try again.'
      );
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      recognitionRef.current = null;
      setIsListening(false);
      setError(err instanceof Error ? err.message : 'Could not start voice entry. Please try again.');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountRupees = Number(amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      setError(isHindi ? 'कृपया सही रकम डालें।' : 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        type,
        amountRupees,
        category,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        occurredAt,
      });
      setAmount('');
      setMerchant('');
      setNote('');
      setOccurredAt(undefined);
      setScanConfidence(null);
      setShowDetails(false);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi
            ? 'रिकॉर्ड सेव नहीं हुआ। कृपया फिर से कोशिश करें।'
            : 'Your record could not be saved. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const categories = DEFAULT_CATEGORIES.filter((item) => item.kind === type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-transaction-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h2 id="add-transaction-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'खर्च या कमाई जोड़ें' : 'Add money record'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={isHindi ? 'बंद करें' : 'Close'}
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              aria-label={isHindi ? 'रसीद या लेन-देन की तस्वीर चुनें' : 'Choose receipt or transaction image'}
              onChange={(event) => {
                void handleScanImage(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              disabled={!isAuthenticated || isScanning || loading}
              onClick={() => imageInputRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              {isScanning ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {isScanning
                ? isHindi ? 'तस्वीर पढ़ रहे हैं…' : 'Reading image…'
                : isHindi ? 'रसीद / स्क्रीनशॉट स्कैन करें' : 'Scan receipt / screenshot'}
            </button>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {isAuthenticated
                ? isHindi
                  ? 'JPG, PNG या WebP, अधिकतम 6 MB। तस्वीर सेव नहीं की जाती। सेव करने से पहले जानकारी जाँचें।'
                  : 'JPG, PNG, or WebP, up to 6 MB. Images are not stored. Review details before saving.'
                : isHindi
                  ? 'तस्वीर स्कैन करने के लिए पहले अपने खाते में साइन इन करें।'
                  : 'Sign in to scan an image into your account.'}
            </p>
            {imagePreviewUrl && (
              <div className="mt-3 flex items-start gap-3">
                <Image
                  src={imagePreviewUrl}
                  alt={isHindi ? 'चुनी हुई लेन-देन की तस्वीर' : 'Selected transaction image'}
                  width={96}
                  height={96}
                  unoptimized
                  className="max-h-24 max-w-24 rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
                />
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {isScanning
                    ? isHindi ? 'जानकारी निकाल रहे हैं…' : 'Extracting transaction details…'
                    : scanConfidence !== null
                      ? isHindi
                        ? 'जानकारी भर दी गई है। कृपया जाँचें और फिर सेव करें।'
                        : 'Details filled in. Please review them before saving.'
                      : isHindi ? 'तस्वीर स्कैन नहीं हुई। विवरण हाथ से भरें।' : 'Image was not scanned. Enter the details manually.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategory('Food & Dining');
              }}
              aria-pressed={type === 'expense'}
              className={`min-h-14 flex-1 rounded-2xl px-3 text-base font-bold transition ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              {isHindi ? 'खर्च हुआ' : 'I spent'}
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('Salary');
              }}
              aria-pressed={type === 'income'}
              className={`min-h-14 flex-1 rounded-2xl px-3 text-base font-bold transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              {isHindi ? 'पैसे मिले' : 'I received'}
            </button>
          </div>

          <div>
            <label htmlFor="transaction-amount" className="block text-base font-semibold text-zinc-800 dark:text-zinc-200">
              {isHindi ? 'कितने रुपये?' : 'How much?'}
            </label>
            <div className="mt-2 flex items-center rounded-2xl border-2 border-zinc-300 bg-zinc-50 px-4 focus-within:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="text-2xl font-bold text-zinc-500">₹</span>
              <input
                id="transaction-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="min-h-16 w-full bg-transparent px-3 text-3xl font-bold text-zinc-900 outline-none dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="transaction-description" className="block text-base font-semibold text-zinc-800 dark:text-zinc-200">
              {isHindi ? 'यह किस लिए था? (ज़रूरी नहीं)' : 'What was it for? (optional)'}
            </label>
            <input
              id="transaction-description"
              type="text"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder={isHindi ? 'जैसे: खाना, बस' : 'For example: lunch, bus'}
              className="mt-2 min-h-14 w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 text-base font-medium text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white"
            />
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <span className="mb-3 block text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              {isHindi ? 'बोलकर बताएं' : 'Say it instead'}
            </span>
            <button
              type="button"
              onClick={isListening ? () => recognitionRef.current?.stop() : startVoiceEntry}
              aria-pressed={isListening}
              className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-white transition ${
                isListening ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-700 hover:bg-emerald-600'
              }`}
            >
              <Mic className="h-5 w-5" />
              {isListening
                ? isHindi ? 'सुन रहे हैं… रोकने के लिए दबाएं' : 'Listening… tap to stop'
                : isHindi ? 'बोलने के लिए दबाएं' : 'Tap to speak'}
            </button>
            <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">
              {isHindi
                ? 'जैसे: “खर्च 50 रुपये बस के लिए”'
                : 'For example: “Spent 50 rupees on the bus”'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="min-h-11 text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            {showDetails
              ? isHindi ? 'कम जानकारी दिखाएं' : 'Hide extra details'
              : isHindi ? 'और जानकारी (ज़रूरी नहीं)' : 'Add more details (optional)'}
          </button>

          {showDetails && (
            <div className="space-y-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
              <div>
                <label htmlFor="transaction-category" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'किस तरह का खर्च?' : 'Type of transaction'}
                </label>
                <select
                  id="transaction-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {categories.map((item) => (
                    <option key={item.name} value={item.name}>{categoryLabel(item.name, language)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="transaction-note" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isHindi ? 'नोट' : 'Note'}
                </label>
                <input
                  id="transaction-note"
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-800 dark:focus:text-white"
                />
              </div>
              {occurredAt && (
                <div>
                  <label htmlFor="transaction-occurred-at" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {isHindi ? 'लेन-देन की तारीख और समय' : 'Transaction date and time'}
                  </label>
                  <input
                    id="transaction-occurred-at"
                    type="datetime-local"
                    value={toDateTimeLocal(occurredAt)}
                    onChange={(event) =>
                      setOccurredAt(event.target.value ? new Date(event.target.value).toISOString() : undefined)
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isListening || isScanning}
            className="min-h-14 w-full rounded-2xl bg-emerald-600 px-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading
              ? isHindi ? 'सेव हो रहा है…' : 'Saving…'
              : isHindi ? 'रिकॉर्ड सेव करें' : 'Save record'}
          </button>
        </form>
      </div>
    </div>
  );
}
