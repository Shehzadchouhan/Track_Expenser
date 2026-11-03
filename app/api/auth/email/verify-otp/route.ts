import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const EmailVerifySchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  token: z.string().trim().min(6, 'Please enter the 6-digit code or token'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EmailVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid parameters' },
        { status: 400 }
      );
    }

    const { email, token } = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error || !data.user) {
      console.error('[Email Auth] verifyOtp error:', error);
      let userFriendlyMsg = error?.message || 'Invalid or expired verification code.';
      if (
        error?.message?.includes('fetch failed') ||
        (error as { name?: string })?.name === 'AuthRetryableFetchError'
      ) {
        userFriendlyMsg =
          'Cannot connect to Supabase (project might be paused in your Supabase dashboard or URL is unreachable).';
      }
      return NextResponse.json(
        { error: userFriendlyMsg },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Signed in successfully!',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    console.error('[Email Auth] Unexpected error in verify-otp:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
