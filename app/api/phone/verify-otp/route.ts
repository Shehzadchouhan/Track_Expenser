import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { PhoneVerificationConfirmSchema } from '@/lib/schemas';
import { whatsappClient } from '@/lib/whatsapp/client';

function hashOtp(phoneNumber: string, otpCode: string): string {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return crypto
    .createHmac('sha256', serviceRoleKey)
    .update(`${phoneNumber}:${otpCode}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = PhoneVerificationConfirmSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const { phone_number: phoneNumber, otp_code: otpCode } = parseResult.data;
    const supabase = await createClient();
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser();
    const admin = createAdminClient();
    const { data: verification, error: verifyError } = await admin
      .rpc('consume_phone_otp', {
        p_phone_number: phoneNumber,
        p_otp_hash: hashOtp(phoneNumber, otpCode),
        p_authenticated_user_id: authenticatedUser?.id ?? null,
      })
      .single();

    if (verifyError || !verification) {
      console.error('[Verify OTP] Failed to verify code:', verifyError);
      return NextResponse.json({ error: 'Could not verify the code. Please try again.' }, { status: 500 });
    }

    if (verification.verification_status !== 'verified' || !verification.verified_user_id) {
      const responses: Record<string, { error: string; status: number }> = {
        missing: { error: 'No active verification request found. Please request a new code.', status: 400 },
        expired: { error: 'Verification code has expired. Please request a new code.', status: 400 },
        locked: { error: 'Too many incorrect attempts. Please request a new code.', status: 400 },
        incorrect: {
          error: `Incorrect verification code. ${verification.remaining_attempts} attempts remaining.`,
          status: 400,
        },
        forbidden: { error: 'Sign in to the account you are linking this number to.', status: 403 },
      };
      const response = responses[verification.verification_status];
      return NextResponse.json(
        { error: response?.error ?? 'Could not verify the code.' },
        { status: response?.status ?? 400 }
      );
    }

    const userId = verification.verified_user_id;
    const { error: settingsError } = await admin
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          phone_number: phoneNumber,
          phone_verified: true,
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('[Verify OTP] Failed to update user settings:', settingsError);
      const status = settingsError.code === '23505' ? 409 : 500;
      return NextResponse.json(
        {
          error:
            status === 409
              ? 'This phone number is already linked to another account.'
              : 'Failed to update the account with this verified phone.',
        },
        { status }
      );
    }

    if (verification.verification_intent === 'sign_in') {
      const digits = phoneNumber.replace(/\D/g, '');
      const { data: generatedLink, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: `phone_${digits}@trackexpenser.local`,
      });

      if (linkError || !generatedLink.properties.hashed_token) {
        console.error('[Verify OTP] Failed to create Supabase session token:', linkError);
        return NextResponse.json(
          { error: 'Phone verified, but sign-in could not be completed. Please request a new code.' },
          { status: 500 }
        );
      }

      const { error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: generatedLink.properties.hashed_token,
        type: 'magiclink',
      });

      if (sessionError) {
        console.error('[Verify OTP] Failed to establish Supabase session:', sessionError);
        return NextResponse.json(
          { error: 'Phone verified, but sign-in could not be completed. Please request a new code.' },
          { status: 500 }
        );
      }
    } else {
      await whatsappClient.sendTextMessage(
        phoneNumber,
        `🎉 *Congratulations!*\n\nYour WhatsApp account is now linked to Track Expenser.\n\nYou can now log expenses anytime:\n• Text: _"Spent 250 on lunch"_\n• Or simply share a payment confirmation screenshot!`
      );
    }

    return NextResponse.json({
      success: true,
      message:
        verification.verification_intent === 'link'
          ? 'Phone number verified and linked successfully!'
          : 'Phone number verified and signed in successfully!',
      phoneNumber,
    });
  } catch (error) {
    console.error('[Verify OTP] Unexpected error:', error);
    return NextResponse.json({ error: 'Could not verify the code. Please try again.' }, { status: 500 });
  }
}
