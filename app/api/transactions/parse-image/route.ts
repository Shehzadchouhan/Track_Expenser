import { NextRequest, NextResponse } from 'next/server';
import { parseImageTransaction } from '@/lib/ai/parse-image';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to scan and save a transaction.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a transaction screenshot or receipt image.' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Use a JPG, PNG, or WebP image.' },
        { status: 415 }
      );
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'The image must be smaller than 6 MB.' },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64Data = bytes.toString('base64');
    const result = await parseImageTransaction({
      base64Data,
      mimeType: file.type,
    });

    if (result.status !== 'success' || result.intent !== 'transaction' || !result.transaction) {
      return NextResponse.json(
        {
          error:
            result.status === 'failed_payment'
              ? 'This image shows a failed or cancelled payment, so it was not added.'
              : 'Could not read a completed transaction. Try a clearer screenshot or enter it manually.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      transaction: {
        ...result.transaction,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    console.error('[Transaction image parser] Failed to parse image:', error);
    return NextResponse.json(
      { error: 'Could not scan this image right now. Please try again or enter it manually.' },
      { status: 500 }
    );
  }
}
