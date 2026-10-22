const businessPhoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, '');

export function getWhatsAppBusinessUrl(message: string): string | null {
  if (!businessPhoneNumber) return null;
  return `https://wa.me/${businessPhoneNumber}?text=${encodeURIComponent(message)}`;
}
