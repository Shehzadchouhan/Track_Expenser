'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, PlusCircle, X, ArrowRightLeft, Landmark, Banknote, Lock, AlertCircle } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { categoryLabel, type AppLanguage } from '@/lib/i18n';
import type { DashboardAccount } from './AccountCards';

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
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'expense' | 'income' | 'transfer';
  initialAccountId?: string;
  initialAmount?: string;
  initialMerchant?: string;
  initialCategory?: string;
  initialNote?: string;
  accounts?: DashboardAccount[];
  isAuthenticated: boolean;
  language: AppLanguage;
  onSubmit: (data: {
    type: 'expense' | 'income' | 'transfer';
    amountRupees: number;
    accountId?: string | null;
    transferToAccountId?: string | null;
    category?: string;
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
  initialAccountId,
  initialAmount,
  initialMerchant,
  initialCategory,
  initialNote,
  accounts = [],
  isAuthenticated,
  language,
  onSubmit,
}: AddTransactionModalProps) {
  const isHindi = language === 'hi';
  const defaultBank = accounts.find((a) => a.type === 'bank' || a.is_default) || accounts[0];
  const defaultCash = accounts.find((a) => a.type === 'cash') || accounts[1] || accounts[0];
  const defaultCashId = defaultCash?.id;

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(initialType);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || defaultBank?.id || ''
  );
  const [amount, setAmount] = useState(initialAmount || '');
  const [category, setCategory] = useState(
    initialCategory ||
      (initialType === 'income'
        ? (initialAccountId === defaultCash?.id ? 'Cash Deposit' : 'Online Deposit')
        : 'Food & Dining')
  );

  const [fromAccountId, setFromAccountId] = useState<string>(defaultBank?.id || '');
  const [toAccountId, setToAccountId] = useState<string>(defaultCash?.id || '');

  const [merchant, setMerchant] = useState(initialMerchant || '');
  const [note, setNote] = useState(initialNote || '');
  const [isListening, setIsListening] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<string | undefined>();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setAmount(initialAmount || '');
      setMerchant(initialMerchant || '');
      setCategory(
        initialCategory ||
          (initialType === 'income'
            ? (initialAccountId === defaultCashId ? 'Cash Deposit' : 'Online Deposit')
            : 'Food & Dining')
      );
      setNote(initialNote || '');
      setError(null);
      setShowDetails(false);
      setOccurredAt(undefined);
    }
  }, [isOpen, initialAmount, initialMerchant, initialCategory, initialNote, initialType, initialAccountId, defaultCashId]);

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(initialAccountId || defaultBank?.id || accounts[0].id);
      setFromAccountId(defaultBank?.id || accounts[0].id);
      setToAccountId(defaultCash?.id || accounts[1]?.id || accounts[0].id);
    }
  }, [accounts, defaultBank, defaultCash, selectedAccountId, initialAccountId]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setAmount('');
    setMerchant('');
    setNote('');
    setError(null);
    setShowDetails(false);
    setOccurredAt(undefined);
    onClose();
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
          ? 'इस ब्राउज़र में आवाज़ से लिखने की सुविधा नहीं है।'
          : 'Voice entry is not available in this browser.'
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
      if (!transcript) return;

      const spokenAmount = extractSpokenAmount(transcript);
      const description = extractDescription(transcript);
      if (spokenAmount) setAmount(spokenAmount);
      if (description) setMerchant(description);

      // If speech mentions cash, route to cash account
      if (/cash|नकद|रोड़ा/i.test(transcript) && defaultCash) {
        setSelectedAccountId(defaultCash.id);
      }
    };
    recognition.onerror = () => {
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
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  const selectedAcc = accounts.find(
    (a) => a.id === (type === 'transfer' ? fromAccountId : selectedAccountId)
  );
  const amountRupees = Number(amount);
  const amountPaise = Number.isFinite(amountRupees) && amountRupees > 0 ? Math.round(amountRupees * 100) : 0;
  const isDeduction = type === 'expense' || (type === 'transfer' && fromAccountId !== toAccountId);
  const isInsufficient =
    isDeduction &&
    amountPaise > 0 &&
    !!selectedAcc &&
    selectedAcc.current_balance_paise < amountPaise;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      setError(isHindi ? 'कृपया सही रकम डालें।' : 'Please enter a valid amount.');
      return;
    }

    if (isInsufficient && selectedAcc) {
      const avail = (Math.max(0, selectedAcc.current_balance_paise) / 100).toFixed(2);
      const needed = amountRupees.toFixed(2);
      setError(
        isHindi
          ? `${selectedAcc.name} में अपर्याप्त बैलेंस है! उपलब्ध: ₹${avail}, आवश्यक: ₹${needed}`
          : `Insufficient money in ${selectedAcc.name}! Available: ₹${avail}, Needed: ₹${needed}`
      );
      return;
    }

    setLoading(true);
    setError(null);

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);

    let effectiveMerchant = merchant.trim();
    if (!effectiveMerchant && type === 'transfer') {
      if (fromAccountId === toAccountId) {
        effectiveMerchant = isHindi ? `${fromAcc?.name ?? 'खाता'} में टॉप-अप` : `${fromAcc?.name ?? 'Account'} Top-up`;
      } else if (toAcc?.purpose === 'savings') {
        effectiveMerchant = isHindi ? `${toAcc.name} में जमा` : `Deposit to ${toAcc.name}`;
      } else if (fromAcc?.purpose === 'savings') {
        effectiveMerchant = isHindi ? `${fromAcc.name} से निकासी` : `Withdrawal from ${fromAcc.name}`;
      } else if ((fromAcc?.type === 'bank' || fromAcc?.is_default) && toAcc?.type === 'cash') {
        effectiveMerchant = isHindi ? 'ATM निकासी' : 'ATM Withdrawal';
      } else {
        effectiveMerchant = `Transfer: ${fromAcc?.name ?? 'From'} → ${toAcc?.name ?? 'To'}`;
      }
    }

    try {
      await onSubmit({
        type,
        amountRupees,
        accountId: type === 'transfer' ? fromAccountId : selectedAccountId,
        transferToAccountId: type === 'transfer' ? toAccountId : undefined,
        category: type === 'transfer' ? 'Transfer' : category,
        merchant: effectiveMerchant || undefined,
        note: note.trim() || undefined,
        occurredAt,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save record.');
    } finally {
      setLoading(false);
    }
  };

  const categories = DEFAULT_CATEGORIES.filter((item) => item.kind === (type === 'transfer' ? 'expense' : type));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-transaction-title"
        className="max-h-[92vh] sm:max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h2 id="add-transaction-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isHindi ? 'लेन-देन दर्ज करें' : 'Record Transaction'}
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* 3-Way Mode Switcher: Expense | Income | Transfer */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategory('Food & Dining');
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {isHindi ? 'खर्च' : 'Expense'}
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('Salary');
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {isHindi ? 'कमाई' : 'Income'}
            </button>
            <button
              type="button"
              onClick={() => {
                setType('transfer');
                setMerchant(isHindi ? 'ATM निकासी' : 'ATM Withdrawal');
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition ${
                type === 'transfer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {isHindi ? 'ट्रांसफर' : 'Transfer'}
            </button>
          </div>

          {/* Transfer Routing Selectors */}
          {type === 'transfer' ? (
            <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{isHindi ? 'खातों के बीच ट्रांसफर' : 'Between Accounts Transfer'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    {isHindi ? 'किस खाते से:' : 'From:'}
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white p-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.purpose === 'savings' ? (isHindi ? 'तिजोरी' : 'Vault') : a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const temp = fromAccountId;
                    setFromAccountId(toAccountId);
                    setToAccountId(temp);
                  }}
                  title={isHindi ? 'खाते आपस में बदलें (Swap)' : 'Swap Source & Destination'}
                  className="mt-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition active:scale-95 shadow-xs"
                >
                  <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </button>

                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    {isHindi ? 'किस खाते में:' : 'To:'}
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white p-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.purpose === 'savings' ? (isHindi ? 'तिजोरी' : 'Vault') : a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {fromAccountId === toAccountId && (
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {isHindi
                    ? '✨ समान खाते में ट्रांसफर: यह इस खाते में सीधे टॉप-अप / बैलेंस जोड़ेगा।'
                    : '✨ Same account transfer: This directly tops up / deposits balance into this account.'}
                </p>
              )}

              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                {isHindi
                  ? '💡 ट्रांसफर से रोज का खर्च बजट (Safe-to-Spend) प्रभावित नहीं होता।'
                  : '💡 Transfers move money between accounts without reducing Safe-to-Spend.'}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {type === 'income'
                    ? (isHindi ? 'कहाँ बैलेंस जोड़ना है?' : 'Add Balance To:')
                    : (isHindi ? 'कहाँ से खर्च हुआ?' : 'Spent From:')}
                </label>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {isHindi ? 'खाता चुनें' : 'Select Account'}
                </span>
              </div>

              {/* All Accounts Available for Selection (Spending & Vaults) */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  const isVault = acc.purpose === 'savings';
                  const isCash = acc.type === 'cash' || acc.name.toLowerCase().includes('cash');

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        if (type === 'income') {
                          if (isCash) {
                            setCategory('Cash Deposit');
                          } else {
                            setCategory('Online Deposit');
                          }
                        }
                      }}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition ${
                        isSelected
                          ? isVault
                            ? 'border-emerald-600 bg-emerald-50/90 shadow-xs ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/40'
                            : isCash
                            ? 'border-amber-600 bg-amber-50/90 shadow-xs ring-2 ring-amber-500/20 dark:border-amber-500 dark:bg-amber-950/40'
                            : 'border-blue-600 bg-blue-50/90 shadow-xs ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/60'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isSelected
                            ? isVault
                              ? 'bg-emerald-600 text-white'
                              : isCash
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                        }`}
                      >
                        {isVault ? (
                          <Lock className="h-4 w-4" />
                        ) : isCash ? (
                          <Banknote className="h-4 w-4" />
                        ) : (
                          <Landmark className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold leading-tight truncate ${
                            isSelected
                              ? 'text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {acc.name}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                          {isVault ? (isHindi ? 'तिजोरी' : 'Vault') : isCash ? (isHindi ? 'नकद' : 'Cash') : 'Bank / Online'}
                          {' • '}
                          <span className={acc.current_balance_paise < 0 ? 'font-bold text-rose-600' : 'font-semibold text-zinc-700 dark:text-zinc-300'}>
                            ₹{(Math.max(0, acc.current_balance_paise) / 100).toFixed(0)}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Real-time Account impact helper note */}
              <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-zinc-100/70 px-3 py-1.5 text-[11px] text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                <span>
                  {accounts.find((a) => a.id === selectedAccountId)?.purpose === 'savings'
                    ? type === 'income'
                      ? (isHindi ? '🔒 यह पैसा आपकी तिजोरी (बचत) में सुरक्षित जमा होगा।' : '🔒 This money will be safely locked into your Savings Vault.')
                      : (isHindi ? '🔒 यह खर्च आपकी तिजोरी (बचत) से कटेगा।' : '🔒 This will be deducted from your Savings Vault.')
                    : (selectedAccountId === defaultCash?.id || accounts.find((a) => a.id === selectedAccountId)?.type === 'cash')
                    ? type === 'income'
                      ? (isHindi ? '💵 यह पैसा आपके "नकद (हाथ में)" बैलेंस में जुड़ेगा।' : '💵 This will add balance to your Cash in Hand.')
                      : (isHindi ? '💵 यह खर्च आपके "नकद (हाथ में)" बैलेंस से कटेगा।' : '💵 This will be deducted from your Cash in Hand.')
                    : type === 'income'
                    ? (isHindi ? '💳 यह पैसा आपके "बैंक / UPI (ऑनलाइन)" बैलेंस में जुड़ेगा।' : '💳 This will add balance to your Online / Bank account.')
                    : (isHindi ? '💳 यह खर्च आपके "बैंक / UPI (ऑनलाइन)" बैलेंस से कटेगा।' : '💳 This will be deducted from your Online / Bank account.')}
                </span>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label htmlFor="transaction-amount" className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              {isHindi ? 'राशि (रुपये)' : 'Amount (₹)'}
            </label>
            <div
              className={`mt-1.5 flex items-center rounded-2xl border-2 px-4 transition-colors focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 ${
                isInsufficient
                  ? 'border-rose-500 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/20'
                  : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'
              }`}
            >
              <span className={`text-2xl font-black ${isInsufficient ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>₹</span>
              <input
                id="transaction-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="0"
                className="min-h-14 w-full bg-transparent px-3 text-2xl sm:text-3xl font-black text-zinc-900 outline-none placeholder-zinc-400 dark:text-zinc-50 dark:placeholder-zinc-500"
              />
            </div>
            {isInsufficient && selectedAcc && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-bold">
                    {isHindi ? 'अपर्याप्त बैलेंस (Insufficient Money)' : 'Insufficient Money'}
                  </p>
                  <p className="mt-0.5 text-[11px] font-normal text-rose-600 dark:text-rose-300">
                    {isHindi
                      ? `${selectedAcc.name} में केवल ₹${(Math.max(0, selectedAcc.current_balance_paise) / 100).toFixed(2)} उपलब्ध है। आप ₹${amountRupees.toFixed(2)} खर्च या ट्रांसफर नहीं कर सकते।`
                      : `Only ₹${(Math.max(0, selectedAcc.current_balance_paise) / 100).toFixed(2)} available in ${selectedAcc.name}. You cannot spend or transfer ₹${amountRupees.toFixed(2)}.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Merchant / Description */}
          <div>
            <label htmlFor="transaction-description" className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              {type === 'transfer'
                ? isHindi ? 'ट्रांसफर का विवरण' : 'Transfer purpose (e.g. ATM, Deposit)'
                : isHindi ? 'दुकानदार / विवरण' : 'Merchant / Payee (e.g. Swiggy, Petrol)'}
            </label>
            <input
              id="transaction-description"
              type="text"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder={type === 'transfer' ? 'ATM Cash Withdrawal' : 'Swiggy / Chai / Petrol'}
              className="mt-1.5 min-h-12 w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 text-base font-semibold text-zinc-900 placeholder-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
            />
          </div>

          {/* Voice Input Button */}
          {type !== 'transfer' && (
            <div className="rounded-2xl bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
              <button
                type="button"
                onClick={isListening ? () => recognitionRef.current?.stop() : startVoiceEntry}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition ${
                  isListening ? 'bg-rose-600' : 'bg-emerald-700 hover:bg-emerald-600'
                }`}
              >
                <Mic className="h-4 w-4" />
                <span>
                  {isListening
                    ? isHindi ? 'सुन रहे हैं… रोकने के लिए दबाएं' : 'Listening… tap to stop'
                    : isHindi ? 'बोलकर दर्ज करें (जैसे: 250 रुपये चाय)' : 'Say it (e.g. "Spent 250 on tea")'}
                </span>
              </button>
            </div>
          )}

          {/* Collapsible Details (Category, Note, Date) */}
          {type !== 'transfer' && (
            <div>
              <button
                type="button"
                onClick={() => setShowDetails((open) => !open)}
                className="text-xs font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300"
              >
                {showDetails
                  ? isHindi ? 'कम विवरण दिखाएं' : 'Hide extra details'
                  : isHindi ? 'श्रेणी और तारीख बदलें' : 'Change category & date'}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {isHindi ? 'श्रेणी (Category)' : 'Category'}
                    </label>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      {categories.map((item) => (
                        <option key={item.name} value={item.name}>{categoryLabel(item.name, language)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {isHindi ? 'तारीख' : 'Date'}
                    </label>
                    <input
                      type="datetime-local"
                      value={occurredAt ? toDateTimeLocal(occurredAt) : ''}
                      onChange={(event) =>
                        setOccurredAt(event.target.value ? new Date(event.target.value).toISOString() : undefined)
                      }
                      className="mt-1.5 min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 focus:border-emerald-600 focus:outline-hidden dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isListening || !!isInsufficient}
            className={`min-h-12 w-full rounded-2xl px-4 text-base font-bold text-white shadow-sm transition disabled:opacity-50 ${
              isInsufficient
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {loading
              ? isHindi ? 'सेव हो रहा है…' : 'Saving…'
              : isInsufficient
              ? isHindi ? '⚠️ अपर्याप्त बैलेंस (रकम कम करें)' : '⚠️ Insufficient Balance'
              : type === 'transfer'
              ? isHindi ? 'ट्रांसफर रिकॉर्ड करें' : 'Record Transfer'
              : isHindi ? 'रिकॉर्ड सेव करें' : 'Save Record'}
          </button>
        </form>
      </div>
    </div>
  );
}
