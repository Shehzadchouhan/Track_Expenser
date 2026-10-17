import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PhoneVerificationRequestSchema } from '@/lib/schemas';
import { whatsappClient } from '@/lib/whatsapp/client';
import { OTP_EXPIRY_MINUTES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = PhoneVerificationRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid phone number' },
        { status: 400 }
      );
    }

    const { phone_number } = parseResult.data;

    // 1. Determine or provision user ID (supports logged-in user or guest web session)
    let userId: string | null = null;
    try {
      const supabaseUser = await createClient();
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Guest web session
    }

    const admin = createAdminClient();

    if (!userId) {
      // Check if user already exists in user_settings
      const { data: existingSettings } = await admin
        .from('user_settings')
        .select('user_id')
        .eq('phone_number', phone_number)
        .maybeSingle();

      if (existingSettings?.user_id) {
        userId = existingSettings.user_id;
      }
    }

    if (!userId) {
      // Find or create an auth user in Supabase for this phone number
      const cleanPhone = phone_number.replace(/\D/g, '');
      const userEmail = `phone_${cleanPhone}@trackexpenser.local`;

      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: { phone_number },
        password: crypto.randomBytes(16).toString('hex'),
      });

      if (newUser?.user?.id) {
        userId = newUser.user.id;
      } else {
        // If user already exists in auth.users, find their id
        const { data: listData } = await admin.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(
          (u) => u.email === userEmail || u.user_metadata?.phone_number === phone_number
        );
        if (existingAuthUser) {
          userId = existingAuthUser.id;
        } else {
          console.error('[Request OTP] Failed to provision auth user:', createError);
          return NextResponse.json(
            { error: 'Failed to initialize user account for this phone number' },
            { status: 500 }
          );
        }
      }

      // Ensure user_settings row exists for this user
      await admin.from('user_settings').upsert(
        {
          user_id: userId,
          phone_number: phone_number,
        },
        { onConflict: 'user_id' }
      );
    }

    // 2. Generate secure 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    console.log(`[Request OTP] >>> Generated OTP for ${phone_number}: ${otpCode} <<<`);

    // 3. Store in phone_verifications table
    const { error: insertError } = await admin.from('phone_verifications').insert({
      user_id: userId,
      phone_number,
      otp_code: otpCode,
      attempts: 0,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('[Request OTP] Failed to insert verification:', insertError);
      return NextResponse.json({ error: 'Failed to create verification request' }, { status: 500 });
    }

    // 4. Send code via WhatsApp
    const sendResult = await whatsappClient.sendTextMessage(
      phone_number,
      `🔐 *Track Expenser Verification*\n\nYour 6-digit verification code is: *${otpCode}*\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, please ignore this message.`
    );

    const isDev = process.env.NODE_ENV !== 'production';

    if (!sendResult.success) {
      console.warn('[Request OTP] WhatsApp message delivery notice:', sendResult.error);
      return NextResponse.json({
        success: true,
        message: `OTP generated! (Check terminal or WhatsApp: ${otpCode})`,
        deliveryNotice: sendResult.error,
        devOtp: isDev ? otpCode : undefined,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to WhatsApp',
      devOtp: isDev ? otpCode : undefined,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error('[Request OTP] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
