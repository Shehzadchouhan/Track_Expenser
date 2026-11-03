import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ResetRequestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const origin = request.nextUrl.origin;
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error('[Reset Password] Supabase error:', error);
      let userFriendlyMsg = error.message || 'Could not send reset link. Please try again.';
      if (error.message?.toLowerCase().includes('rate limit')) {
        userFriendlyMsg = 'Too many requests. Please wait a few minutes before requesting another reset link.';
      }
      return NextResponse.json({ error: userFriendlyMsg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent! Please check your email inbox.',
    });
  } catch (err) {
    console.error('[Reset Password] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
