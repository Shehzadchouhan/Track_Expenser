/**
 * UPI (Unified Payments Interface) deep-link utilities for Indian payments.
 * Generates standards-compliant NPCI 'upi://pay' intent URLs.
 */

export interface UpiIntentParams {
  upiId: string;
  payeeName?: string;
  amountRupees: number;
  transactionNote?: string;
}

export interface UpiQrDetails {
  upiId: string;
  payeeName?: string;
  amountRupees?: number;
}

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const MAX_AMOUNT_RUPEES = 100_000_000;

/**
 * Validates whether a given string is a valid UPI VPA (Virtual Payment Address).
 * e.g. 'username@okhdfcbank', '9876543210@paytm', 'user@upi'
 */
export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  return UPI_ID_REGEX.test(upiId.trim());
}

export function normalizeIndianMobileNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  const digits = compact.startsWith('+91') ? compact.slice(3) : compact;
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function parseUpiQrCode(value: string): UpiQrDetails | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol.toLowerCase() !== 'upi:' || url.hostname.toLowerCase() !== 'pay') {
    return null;
  }

  const upiId = url.searchParams.get('pa')?.trim() ?? '';
  const currency = url.searchParams.get('cu')?.trim().toUpperCase();
  const amountValue = url.searchParams.get('am');
  if (!isValidUpiId(upiId) || (currency && currency !== 'INR')) return null;

  let amountRupees: number | undefined;
  if (amountValue !== null) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountValue)) return null;
    amountRupees = Number(amountValue);
    if (
      !Number.isFinite(amountRupees) ||
      amountRupees <= 0 ||
      amountRupees > MAX_AMOUNT_RUPEES
    ) {
      return null;
    }
  }

  const payeeName = url.searchParams.get('pn')?.trim().slice(0, 50) || undefined;
  return { upiId, payeeName, amountRupees };
}

/**
 * Generates an NPCI-compliant 'upi://pay' deep link.
 * On mobile devices, clicking this URL opens installed UPI applications
 * (Google Pay, PhonePe, Paytm, BHIM, Navi, CRED, etc.) with the amount pre-filled.
 */
export function buildUpiPayUrl({
  upiId,
  payeeName = 'Savings Account',
  amountRupees,
  transactionNote = 'Track Expenser Savings Deposit',
}: UpiIntentParams): string {
  const cleanId = upiId.trim();
  const cleanName = payeeName.trim().slice(0, 50);
  const cleanNote = transactionNote.trim().slice(0, 80);
  const formattedAmount = amountRupees.toFixed(2);

  const params = new URLSearchParams({
    pa: cleanId,
    pn: cleanName,
    am: formattedAmount,
    cu: 'INR',
    tn: cleanNote,
  });

  return `upi://pay?${params.toString()}`;
}
