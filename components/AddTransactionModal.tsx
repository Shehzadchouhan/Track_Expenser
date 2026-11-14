'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Landmark,
  Lock,
  Mic,
  PlusCircle,
  QrCode,
  Smartphone,
  X,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, MAX_PAISE } from '@/lib/constants';
import { categoryLabel, type AppLanguage } from '@/lib/i18n';
import {
  buildUpiPayUrl,
  normalizeIndianMobileNumber,
  parseUpiQrCode,
  type UpiQrDetails,
} from '@/lib/upi';
import type { DashboardAccount } from './AccountCards';
import type { IScannerControls } from '@zxing/browser';

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

interface UpiPaymentDraft {
  version: 1;
  method: 'phone' | 'qr';
  amount: string;
  accountId: string;
  category: string;
  merchant: string;
  note: string;
  occurredAt?: string;
}

const UPI_PAYMENT_DRAFT_KEY = 'track_expenser_upi_payment_draft';

function isUpiPaymentDraft(value: unknown): value is UpiPaymentDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    (draft.method === 'phone' || draft.method === 'qr') &&
    typeof draft.amount === 'string' &&
    typeof draft.accountId === 'string' &&
    typeof draft.category === 'string' &&
    typeof draft.merchant === 'string' &&
    typeof draft.note === 'string' &&
    (draft.occurredAt === undefined || typeof draft.occurredAt === 'string')
  );
}

function readUpiPaymentDraft(): UpiPaymentDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const storedDraft = localStorage.getItem(UPI_PAYMENT_DRAFT_KEY);
    if (!storedDraft) return null;
    const draft: unknown = JSON.parse(storedDraft);
    return isUpiPaymentDraft(draft) ? draft : null;
  } catch (error) {
    console.warn('[UPI] Could not restore pending payment draft:', error);
    return null;
  }
}

function UpiQrCameraScanner({
  onResult,
  onError,
}: {
  onResult: (value: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let active = true;
    let controls: IScannerControls | undefined;

    const startScanner = async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (!active || !result) return;
            active = false;
            controls?.stop();
            onResult(result.getText());
          }
        );
        if (!active) controls.stop();
      } catch {
        if (active) {
          onError('Camera access is unavailable. Upload a QR image instead.');
        }
      }
    };

    void startScanner();
    return () => {
      active = false;
      controls?.stop();
    };
  }, [onError, onResult]);

  return (
    <video
      ref={videoRef}
      className="mt-3 aspect-video w-full rounded-xl bg-black object-cover"
      muted
      playsInline
      autoPlay
      aria-label="UPI QR code camera preview"
    />
  );
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
    paymentMethod?: 'upi';
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
  const [restoredUpiDraft] = useState(readUpiPaymentDraft);

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    restoredUpiDraft ? 'expense' : initialType
  );
  const [selectedAccountIdState, setSelectedAccountId] = useState<string>(
    restoredUpiDraft?.accountId || initialAccountId || defaultBank?.id || ''
  );
  const selectedAccountId =
    selectedAccountIdState || initialAccountId || defaultBank?.id || accounts[0]?.id || '';
  const [amount, setAmount] = useState(restoredUpiDraft?.amount || initialAmount || '');
  const [category, setCategory] = useState(
    restoredUpiDraft?.category ||
      initialCategory ||
      (initialType === 'income'
        ? (initialAccountId === defaultCash?.id ? 'Cash Deposit' : 'Online Deposit')
        : 'Food & Dining')
  );

  const [fromAccountIdState, setFromAccountId] = useState<string>(defaultBank?.id || '');
  const [toAccountIdState, setToAccountId] = useState<string>(defaultCash?.id || '');
  const fromAccountId = fromAccountIdState || defaultBank?.id || accounts[0]?.id || '';
  const toAccountId =
    toAccountIdState || defaultCash?.id || accounts[1]?.id || accounts[0]?.id || '';

  const [merchant, setMerchant] = useState(restoredUpiDraft?.merchant || initialMerchant || '');
  const [note, setNote] = useState(restoredUpiDraft?.note || initialNote || '');
  const [isListening, setIsListening] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<string | undefined>(restoredUpiDraft?.occurredAt);
  const [upiStep, setUpiStep] = useState<'choose' | 'phone' | 'qr' | 'confirm' | null>(
    restoredUpiDraft ? 'confirm' : null
  );
  const [upiMethod, setUpiMethod] = useState<'phone' | 'qr' | null>(
    restoredUpiDraft?.method ?? null
  );
  const [upiPhoneNumber, setUpiPhoneNumber] = useState('');
  const [upiQrDetails, setUpiQrDetails] = useState<UpiQrDetails | null>(null);
  const [fixedQrAmount, setFixedQrAmount] = useState<number | null>(null);
  const [upiInfoMessage, setUpiInfoMessage] = useState<string | null>(null);
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [isReadingQrImage, setIsReadingQrImage] = useState(false);
  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const upiStepRef = useRef(upiStep);
  const updateUpiStep = useCallback(
    (step: 'choose' | 'phone' | 'qr' | 'confirm' | null) => {
      upiStepRef.current = step;
      setUpiStep(step);
    },
    []
  );

  useEffect(() => {
    if (isOpen && upiStepRef.current !== 'confirm') {
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
      updateUpiStep(null);
      setUpiMethod(null);
      setShowDetails(false);
      setOccurredAt(undefined);
      setUpiPhoneNumber('');
      setUpiQrDetails(null);
      setFixedQrAmount(null);
      setUpiInfoMessage(null);
    }
  }, [
    isOpen,
    initialAmount,
    initialMerchant,
    initialCategory,
    initialNote,
    initialType,
    initialAccountId,
    defaultCashId,
    updateUpiStep,
  ]);

  useEffect(() => {
    if (initialAccountId && upiStepRef.current !== 'confirm') {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleClose = (preservePendingPayment = upiStep === 'confirm') => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsScanningQr(false);
    setIsListening(false);
    if (!preservePendingPayment) {
      setAmount('');
      setMerchant('');
      setNote('');
      setError(null);
      setShowDetails(false);
      setOccurredAt(undefined);
      updateUpiStep(null);
      setUpiMethod(null);
      setUpiPhoneNumber('');
      setUpiQrDetails(null);
      setFixedQrAmount(null);
      setUpiInfoMessage(null);
    }
    onClose();
  };

  const handleQrResult = useCallback(
    (value: string) => {
      const details = parseUpiQrCode(value);
      setIsScanningQr(false);
      if (!details) {
        setError(
          isHindi
            ? 'यह मान्य UPI भुगतान QR कोड नहीं है।'
            : 'This is not a valid UPI payment QR code.'
        );
        return;
      }

      setError(null);
      setUpiQrDetails(details);
      setFixedQrAmount(details.amountRupees ?? null);
      setUpiInfoMessage(null);
      if (details.payeeName && !merchant.trim()) setMerchant(details.payeeName);
      if (details.amountRupees !== undefined) setAmount(details.amountRupees.toFixed(2));
      updateUpiStep('qr');
    },
    [isHindi, merchant, updateUpiStep]
  );

  const handleQrScannerError = useCallback(
    () => {
      setIsScanningQr(false);
      setError(
        isHindi
          ? 'कैमरा उपलब्ध नहीं है। इसके बजाय QR की तस्वीर अपलोड करें।'
          : 'Camera access is unavailable. Upload a QR image instead.'
      );
    },
    [isHindi]
  );

  const savePendingUpiDraft = () => {
    if (
      !Number.isFinite(amountRupees) ||
      amountRupees <= 0 ||
      amountRupees * 100 > MAX_PAISE
    ) {
      setError(isHindi ? 'कृपया पहले सही राशि डालें।' : 'Enter a valid amount first.');
      return false;
    }

    const draft: UpiPaymentDraft = {
      version: 1,
      method: upiMethod ?? 'qr',
      amount,
      accountId: selectedAccountId,
      category,
      merchant: merchant.trim(),
      note: note.trim(),
      occurredAt,
    };

    try {
      localStorage.setItem(UPI_PAYMENT_DRAFT_KEY, JSON.stringify(draft));
      return true;
    } catch {
      setError(
        isHindi
          ? 'भुगतान विवरण सुरक्षित नहीं हो सके। कृपया फिर से कोशिश करें।'
          : 'Could not save this payment draft. Please try again.'
      );
      return false;
    }
  };

  const handlePreparePhonePayment = async () => {
    const normalizedPhone = normalizeIndianMobileNumber(upiPhoneNumber);
    if (!normalizedPhone) {
      setError(
        isHindi
          ? 'मान्य भारतीय मोबाइल नंबर डालें।'
          : 'Enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedPhone);
    } catch {
      setError(
        isHindi
          ? 'नंबर कॉपी नहीं हो सका। कृपया अनुमति दें या नंबर मैन्युअली कॉपी करें।'
          : 'Could not copy the number. Allow clipboard access or copy it manually.'
      );
      return;
    }
    if (!savePendingUpiDraft()) return;
    setUpiPhoneNumber(normalizedPhone);
    setError(null);
    updateUpiStep('confirm');
  };

  const handleLaunchQrPayment = () => {
    if (!upiQrDetails) return;
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      setError(isHindi ? 'कृपया पहले सही राशि डालें।' : 'Enter a valid amount first.');
      return;
    }
    if (fixedQrAmount !== null && amountRupees !== fixedQrAmount) {
      setError(
        isHindi
          ? `इस QR कोड के लिए राशि ₹${fixedQrAmount.toFixed(2)} होनी चाहिए।`
          : `This QR code requires an amount of ₹${fixedQrAmount.toFixed(2)}.`
      );
      return;
    }
    if (!savePendingUpiDraft()) return;

    const payUrl = buildUpiPayUrl({
      upiId: upiQrDetails.upiId,
      payeeName: upiQrDetails.payeeName || merchant || 'UPI Payment',
      amountRupees,
      transactionNote: merchant || 'Track Expenser Expense',
    });
    setError(null);
    updateUpiStep('confirm');
    window.location.assign(payUrl);
  };

  const handleCopyQrUpiId = async () => {
    if (!upiQrDetails) return;
    try {
      await navigator.clipboard.writeText(upiQrDetails.upiId);
      setUpiInfoMessage(isHindi ? 'UPI ID कॉपी हो गया।' : 'UPI ID copied.');
      setError(null);
    } catch {
      setError(
        isHindi
          ? 'UPI ID कॉपी नहीं हो सका।'
          : 'Could not copy the UPI ID.'
      );
    }
  };

  const handleQrImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(isHindi ? 'QR तस्वीर 10 MB से छोटी होनी चाहिए।' : 'QR image must be smaller than 10 MB.');
      input.value = '';
      return;
    }

    setIsReadingQrImage(true);
    setError(null);
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(imageUrl);
      handleQrResult(result.getText());
    } catch {
      setError(
        isHindi
          ? 'तस्वीर में QR कोड नहीं मिला। साफ़ QR तस्वीर चुनें।'
          : 'No readable QR code found. Choose a clear QR image.'
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
      input.value = '';
      setIsReadingQrImage(false);
    }
  };

  const handleConfirmUpiPayment = async () => {
    if (
      !Number.isFinite(amountRupees) ||
      amountRupees <= 0 ||
      amountRupees * 100 > MAX_PAISE
    ) {
      setError(isHindi ? 'कृपया सही राशि डालें।' : 'Enter a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        type: 'expense',
        amountRupees,
        accountId: selectedAccountId,
        category,
        merchant: merchant.trim() || upiQrDetails?.payeeName,
        note: note.trim() || undefined,
        occurredAt,
        paymentMethod: 'upi',
      });
      try {
        localStorage.removeItem(UPI_PAYMENT_DRAFT_KEY);
      } catch (cleanupError) {
        console.warn('[UPI] Could not clear completed payment draft:', cleanupError);
      }
      handleClose(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHindi
            ? 'खर्च रिकॉर्ड नहीं हो सका। फिर से कोशिश करें।'
            : 'Could not record the expense. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardUpiPayment = () => {
    try {
      localStorage.removeItem(UPI_PAYMENT_DRAFT_KEY);
    } catch {
      setError(isHindi ? 'भुगतान ड्राफ्ट हटाया नहीं जा सका।' : 'Could not clear the payment draft.');
      return;
    }
    updateUpiStep('choose');
    setUpiMethod(null);
    setUpiQrDetails(null);
    setFixedQrAmount(null);
    setUpiInfoMessage(null);
    setUpiPhoneNumber('');
    setError(null);
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
  const isQrAmountMismatch = fixedQrAmount !== null && amountRupees !== fixedQrAmount;
  const isDeduction = type === 'expense' || (type === 'transfer' && fromAccountId !== toAccountId);
  const isInsufficient =
    isDeduction &&
    amountPaise > 0 &&
    !!selectedAcc &&
    selectedAcc.current_balance_paise < amountPaise;
  const showInsufficientBalance = isInsufficient && upiStep === null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (upiStep !== null) return;
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

  if (!isOpen) return null;

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
            onClick={() => handleClose()}
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
                showInsufficientBalance
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
            {showInsufficientBalance && selectedAcc && (
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

          {type === 'expense' && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
              {upiStep !== 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      updateUpiStep(upiStep ? null : 'choose');
                      setUpiMethod(null);
                    }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-600"
                  >
                    <Smartphone className="h-4 w-4" />
                    {isHindi ? 'UPI से भुगतान करें' : 'Pay with UPI'}
                  </button>

                  {upiStep === 'choose' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUpiMethod('phone');
                          setUpiPhoneNumber('');
                          updateUpiStep('phone');
                          setError(null);
                        }}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-zinc-900 dark:text-violet-200"
                      >
                        <Smartphone className="h-4 w-4" />
                        {isHindi ? 'फोन नंबर' : 'Phone number'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUpiMethod('qr');
                          setUpiQrDetails(null);
                          setFixedQrAmount(null);
                          updateUpiStep('qr');
                          setError(null);
                        }}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-zinc-900 dark:text-violet-200"
                      >
                        <QrCode className="h-4 w-4" />
                        {isHindi ? 'QR कोड' : 'QR code'}
                      </button>
                    </div>
                  )}

                  {upiStep === 'phone' && (
                    <div className="mt-3 space-y-3">
                      <label
                        htmlFor="upi-recipient-phone"
                        className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                      >
                        {isHindi ? 'प्राप्तकर्ता का मोबाइल नंबर' : 'Recipient mobile number'}
                      </label>
                      <input
                        id="upi-recipient-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={upiPhoneNumber}
                        onChange={(event) => setUpiPhoneNumber(event.target.value)}
                        placeholder="+91 98765 43210"
                        className="min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 focus:border-violet-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {isHindi
                          ? 'फोन नंबर से भुगतान हर UPI ऐप में अलग तरह से काम करता है। हम नंबर कॉपी करेंगे; अपने UPI ऐप में संपर्क खोजें और भुगतान के बाद यहां लौटें।'
                          : 'Phone-number lookup varies by UPI app. We’ll copy the number; search for the contact in your UPI app, pay there, then return here.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handlePreparePhonePayment()}
                        disabled={loading}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" />
                        {isHindi ? 'नंबर कॉपी करें और जारी रखें' : 'Copy number and continue'}
                      </button>
                    </div>
                  )}

                  {upiStep === 'qr' && (
                    <div className="mt-3 space-y-3">
                      {!upiQrDetails ? (
                        <>
                          <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {isHindi
                              ? 'दूसरे डिवाइस पर दिख रहे QR को कैमरे से स्कैन करें, या इस डिवाइस पर QR की तस्वीर चुनें।'
                              : 'Scan a QR shown on another screen, or choose an image of the QR code on this device.'}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setIsScanningQr(true)}
                              disabled={isScanningQr || isReadingQrImage}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:bg-zinc-900 dark:text-violet-200"
                            >
                              <QrCode className="h-4 w-4" />
                              {isScanningQr
                                ? isHindi ? 'स्कैन हो रहा है…' : 'Scanning…'
                                : isHindi ? 'कैमरा स्कैन' : 'Scan with camera'}
                            </button>
                            <button
                              type="button"
                              onClick={() => qrImageInputRef.current?.click()}
                              disabled={isScanningQr || isReadingQrImage}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:bg-zinc-900 dark:text-violet-200"
                            >
                              <ImageIcon className="h-4 w-4" />
                              {isReadingQrImage
                                ? isHindi ? 'पढ़ रहे हैं…' : 'Reading…'
                                : isHindi ? 'तस्वीर चुनें' : 'Choose image'}
                            </button>
                          </div>
                          <input
                            ref={qrImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => void handleQrImageSelected(event)}
                          />
                          {isScanningQr && (
                            <div>
                              <UpiQrCameraScanner
                                onResult={handleQrResult}
                                onError={handleQrScannerError}
                              />
                              <button
                                type="button"
                                onClick={() => setIsScanningQr(false)}
                                className="mt-2 min-h-10 w-full rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                              >
                                {isHindi ? 'स्कैन रोकें' : 'Stop scanning'}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl bg-white p-3 text-xs dark:bg-zinc-900">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">
                              {upiQrDetails.payeeName || upiQrDetails.upiId}
                            </p>
                            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{upiQrDetails.upiId}</p>
                            {fixedQrAmount !== null && (
                              <p className="mt-1 font-semibold text-violet-700 dark:text-violet-300">
                                {isHindi
                                  ? `QR राशि: ₹${fixedQrAmount.toFixed(2)}`
                                  : `QR amount: ₹${fixedQrAmount.toFixed(2)}`}
                              </p>
                            )}
                          </div>
                          {isQrAmountMismatch && (
                            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                              {isHindi
                                ? `इस QR कोड के लिए राशि ₹${fixedQrAmount?.toFixed(2)} होनी चाहिए।`
                                : `This QR code requires an amount of ₹${fixedQrAmount?.toFixed(2)}.`}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={handleLaunchQrPayment}
                            disabled={loading || !amountRupees || isQrAmountMismatch}
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {isHindi
                              ? `UPI ऐप में ₹${Number.isFinite(amountRupees) ? amountRupees.toFixed(2) : '0.00'} भुगतान करें`
                              : `Pay ₹${Number.isFinite(amountRupees) ? amountRupees.toFixed(2) : '0.00'} in UPI app`}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyQrUpiId()}
                            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-zinc-900 dark:text-violet-200"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {isHindi ? 'UPI ID कॉपी करें' : 'Copy UPI ID'}
                          </button>
                          {upiInfoMessage && (
                            <p role="status" className="text-center text-[11px] text-emerald-700 dark:text-emerald-300">
                              {upiInfoMessage}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm font-bold text-violet-950 dark:text-violet-100">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" />
                    <span>
                      {isHindi
                        ? `₹${amountRupees.toFixed(2)} का भुगतान पूरा हुआ?`
                        : `Did you complete the ₹${amountRupees.toFixed(2)} payment?`}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {upiMethod === 'phone'
                      ? isHindi
                        ? `नंबर ${upiPhoneNumber || 'कॉपी किए गए नंबर'} को अपने UPI ऐप में खोजें। भुगतान सफल होने पर ही खर्च रिकॉर्ड करें।`
                        : `Search for ${upiPhoneNumber || 'the copied number'} in your UPI app. Record the expense only if that app showed the payment succeeded.`
                      : isHindi
                        ? 'यदि QR कोड स्कैन किया था, तो UPI ऐप में भुगतान सफल दिखने के बाद ही खर्च रिकॉर्ड करें।'
                        : 'Record the expense only if your UPI app showed the payment succeeded.'}
                  </p>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    {isHindi
                      ? 'Track Expenser भुगतान की पुष्टि नहीं कर सकता।'
                      : 'Track Expenser cannot verify the payment.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleConfirmUpiPayment()}
                    disabled={loading}
                    className="min-h-11 w-full rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading
                      ? isHindi ? 'रिकॉर्ड हो रहा है…' : 'Recording…'
                      : isHindi ? 'हाँ, भुगतान हुआ — खर्च रिकॉर्ड करें' : 'Yes, paid — record expense'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardUpiPayment}
                    disabled={loading}
                    className="min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {isHindi ? 'भुगतान नहीं हुआ' : 'I did not pay'}
                  </button>
                </div>
              )}
            </section>
          )}

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

          {upiStep !== 'confirm' && (
            <button
              type="submit"
              disabled={loading || isListening || showInsufficientBalance}
              className={`min-h-12 w-full rounded-2xl px-4 text-base font-bold text-white shadow-sm transition disabled:opacity-50 ${
                showInsufficientBalance
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {loading
                ? isHindi ? 'सेव हो रहा है…' : 'Saving…'
                : showInsufficientBalance
                ? isHindi ? '⚠️ अपर्याप्त बैलेंस (रकम कम करें)' : '⚠️ Insufficient Balance'
                : type === 'transfer'
                ? isHindi ? 'ट्रांसफर रिकॉर्ड करें' : 'Record Transfer'
                : isHindi ? 'रिकॉर्ड सेव करें' : 'Save Record'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
