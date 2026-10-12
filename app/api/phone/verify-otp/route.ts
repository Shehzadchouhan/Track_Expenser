import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PhoneVerificationConfirmSchema } from '@/lib/schemas';
import { whatsappClient } from '@/lib/whatsapp/client';
import { MAX_OTP_ATTEMPTS } from '@/lib/constants';

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

    const { phone_number, otp_code } = parseResult.data;
    const admin = createAdminClient();

    // 1. Fetch latest unverified verification request for this phone
    const { data: record, error: fetchError } = await admin
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', phone_number)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'No active verification request found. Please request a new code.' },
        { status: 400 }
      );
    }

    // 2. Check expiration
    const now = new Date();
    const expiresAt = new Date(record.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // 3. Check attempts
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    // 4. Verify OTP Match
    if (record.otp_code !== otp_code) {
      // Increment attempt counter
      await admin
        .from('phone_verifications')
        .update({ attempts: record.attempts + 1 })
        .eq('id', record.id);

      const remainingAttempts = MAX_OTP_ATTEMPTS - (record.attempts + 1);
      return NextResponse.json(
        { error: `Incorrect verification code. ${remainingAttempts} attempts remaining.` },
        { status: 400 }
      );
    }

    // 5. Mark verification as completed
    await admin
      .from('phone_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', record.id);

    // 6. Update user_settings to mark phone as verified
    const { error: settingsError } = await admin
      .from('user_settings')
      .upsert(
        {
          user_id: record.user_id,
          phone_number,
          phone_verified: true,
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('[Verify OTP] Failed to update user_settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to update user profile with verified phone.' },
        { status: 500 }
      );
    }

    // 7. Send WhatsApp confirmation welcome message
    await whatsappClient.sendTextMessage(
      phone_number,
      `🎉 *Congratulations!*\n\nYour WhatsApp account is now linked to Track Expenser.\n\nYou can now log expenses anytime:\n• Text: _"Spent 250 on lunch"_\n• Or simply share a payment confirmation screenshot!`
    );

    return NextResponse.json({
      success: true,
      message: 'Phone number verified and linked successfully!',
      userId: record.user_id,
      phoneNumber: phone_number,
    });
  } catch (error) {
    console.error('[Verify OTP] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
