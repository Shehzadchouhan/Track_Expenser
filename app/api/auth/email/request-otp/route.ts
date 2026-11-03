import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const EmailRequestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EmailRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const origin = request.nextUrl.origin;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error('[Email Auth] signInWithOtp error:', error);
      let userFriendlyMsg = error.message || 'Failed to send login code. Please try again.';
      if (
        error.message?.includes('fetch failed') ||
        (error as { name?: string }).name === 'AuthRetryableFetchError'
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
      message: 'A sign-in link and verification code have been sent to your email.',
    });
  } catch (err) {
    console.error('[Email Auth] Unexpected error in request-otp:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
