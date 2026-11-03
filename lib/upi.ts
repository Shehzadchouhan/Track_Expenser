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

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * Validates whether a given string is a valid UPI VPA (Virtual Payment Address).
 * e.g. 'username@okhdfcbank', '9876543210@paytm', 'user@upi'
 */
export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  return UPI_ID_REGEX.test(upiId.trim());
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
