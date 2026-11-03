import { NextRequest, NextResponse } from 'next/server';
import { parseImageTransaction } from '@/lib/ai/parse-image';
import { parseTextTransaction } from '@/lib/ai/parse-text';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const receiptFile = formData.get('receipt');
    const sharedText = (formData.get('text') as string | null) || (formData.get('title') as string | null);

    const redirectUrl = new URL('/', request.url);

    // 1. If an image receipt was shared from GPay / PhonePe / Paytm
    if (receiptFile instanceof File && receiptFile.size > 0 && receiptFile.type.startsWith('image/')) {
      const bytes = Buffer.from(await receiptFile.arrayBuffer());
      const base64Data = bytes.toString('base64');

      const result = await parseImageTransaction({
        base64Data,
        mimeType: receiptFile.type,
      });

      if (result.status === 'success' && result.transaction) {
        redirectUrl.searchParams.set('shared_amount', String(result.transaction.amount_paise));
        if (result.transaction.merchant) {
          redirectUrl.searchParams.set('shared_merchant', result.transaction.merchant);
        }
        if (result.transaction.category) {
          redirectUrl.searchParams.set('shared_category', result.transaction.category);
        }
        if (result.transaction.note) {
          redirectUrl.searchParams.set('shared_note', result.transaction.note);
        }
        redirectUrl.searchParams.set('shared_type', result.transaction.type || 'expense');
        redirectUrl.searchParams.set('shared_source', 'share_sheet');
        return NextResponse.redirect(redirectUrl, 303);
      }
    }

    // 2. If transaction text was shared (e.g. UPI confirmation text or SMS copy)
    if (sharedText && sharedText.trim().length > 0) {
      const textResult = await parseTextTransaction(sharedText.trim());
      if (textResult.intent === 'transaction' && textResult.transaction) {
        redirectUrl.searchParams.set('shared_amount', String(textResult.transaction.amount_paise));
        if (textResult.transaction.merchant) {
          redirectUrl.searchParams.set('shared_merchant', textResult.transaction.merchant);
        }
        if (textResult.transaction.category) {
          redirectUrl.searchParams.set('shared_category', textResult.transaction.category);
        }
        if (textResult.transaction.note) {
          redirectUrl.searchParams.set('shared_note', textResult.transaction.note);
        }
        redirectUrl.searchParams.set('shared_type', textResult.transaction.type || 'expense');
        redirectUrl.searchParams.set('shared_source', 'share_sheet');
        return NextResponse.redirect(redirectUrl, 303);
      }
    }

    // Fallback: If parsing couldn't extract an amount, open manual modal
    redirectUrl.searchParams.set('open_scanner', '1');
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    console.error('[Share Receipt Route] Failed to process shared receipt:', error);
    return NextResponse.redirect(new URL('/?open_scanner=1', request.url), 303);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/?open_scanner=1', request.url), 303);
}
