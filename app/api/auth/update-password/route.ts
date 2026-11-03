import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const UpdatePasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UpdatePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid password' },
        { status: 400 }
      );
    }

    const { password } = parsed.data;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Session expired or invalid reset link. Please request a new password reset.' },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error('[Update Password] Error:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Could not update password. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! You can now sign in.',
    });
  } catch (err) {
    console.error('[Update Password] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.' },
      { status: 500 }
    );
  }
}
