import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PhoneVerificationRequestSchema } from '@/lib/schemas';
import { whatsappClient } from '@/lib/whatsapp/client';
import { OTP_EXPIRY_MINUTES } from '@/lib/constants';

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
    const parseResult = PhoneVerificationRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid phone number' },
        { status: 400 }
      );
    }

    const { phone_number: phoneNumber, intent } = parseResult.data;
    const supabase = await createClient();
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser();

    if (intent === 'link' && !authenticatedUser) {
      return NextResponse.json({ error: 'Sign in before linking a WhatsApp number.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: rateLimit, error: rateLimitError } = await admin
      .rpc('reserve_phone_otp_request', { p_phone_number: phoneNumber })
      .single();

    if (rateLimitError || !rateLimit) {
      console.error('[Request OTP] Failed to reserve rate limit:', rateLimitError);
      return NextResponse.json({ error: 'Could not request a verification code.' }, { status: 500 });
    }

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many code requests. Please wait before trying again.',
          retryAfterSeconds: rateLimit.retry_after_seconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retry_after_seconds) },
        }
      );
    }

    const { data: existingSettings, error: settingsLookupError } = await admin
      .from('user_settings')
      .select('user_id, phone_number, phone_verified')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (settingsLookupError) {
      console.error('[Request OTP] Failed to look up phone:', settingsLookupError);
      return NextResponse.json({ error: 'Could not initialize this account.' }, { status: 500 });
    }

    if (
      intent === 'link' &&
      existingSettings &&
      existingSettings.user_id !== authenticatedUser?.id
    ) {
      return NextResponse.json(
        { error: 'This phone number is already linked to another account.' },
        { status: 409 }
      );
    }

    if (intent === 'link' && authenticatedUser) {
      const { data: currentSettings, error: currentSettingsError } = await admin
        .from('user_settings')
        .select('phone_number, phone_verified')
        .eq('user_id', authenticatedUser.id)
        .maybeSingle();

      if (currentSettingsError) {
        console.error('[Request OTP] Failed to inspect current account:', currentSettingsError);
        return NextResponse.json({ error: 'Could not initialize this account.' }, { status: 500 });
      }

      if (
        currentSettings?.phone_verified &&
        currentSettings.phone_number &&
        currentSettings.phone_number !== phoneNumber
      ) {
        return NextResponse.json(
          { error: 'Unlink the current verified number before linking another.' },
          { status: 409 }
        );
      }
    }

    let userId = intent === 'link' ? authenticatedUser?.id ?? null : existingSettings?.user_id ?? null;

    if (!userId && intent === 'sign_in') {
      const { data: priorRequest, error: priorRequestError } = await admin
        .from('phone_verifications')
        .select('user_id')
        .eq('phone_number', phoneNumber)
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorRequestError) {
        console.error('[Request OTP] Failed to find pending account:', priorRequestError);
        return NextResponse.json({ error: 'Could not initialize this account.' }, { status: 500 });
      }
      userId = priorRequest?.user_id ?? null;
    }

    if (!userId) {
      const digits = phoneNumber.replace(/\D/g, '');
      const userEmail = `phone_${digits}@trackexpenser.local`;
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: { phone_number: phoneNumber },
        password: crypto.randomBytes(32).toString('hex'),
      });

      if (createError || !newUser.user) {
        console.error('[Request OTP] Failed to provision auth user:', createError);
        return NextResponse.json({ error: 'Could not initialize this account.' }, { status: 500 });
      }
      userId = newUser.user.id;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const { error: insertError } = await admin.from('phone_verifications').insert({
      user_id: userId,
      phone_number: phoneNumber,
      otp_code: null,
      otp_hash: hashOtp(phoneNumber, otpCode),
      intent,
      attempts: 0,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error('[Request OTP] Failed to insert verification:', insertError);
      return NextResponse.json({ error: 'Failed to create verification request.' }, { status: 500 });
    }

    const sendResult = await whatsappClient.sendTextMessage(
      phoneNumber,
      `🔐 *Track Expenser Verification*\n\nYour 6-digit verification code is: *${otpCode}*\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, please ignore this message.`
    );
    const isDev = process.env.NODE_ENV !== 'production';

    if (!sendResult.success) {
      console.warn('[Request OTP] WhatsApp message delivery notice:', sendResult.error);
      await admin
        .from('phone_verifications')
        .update({ expires_at: new Date().toISOString() })
        .eq('phone_number', phoneNumber)
        .is('verified_at', null);

      if (!isDev) {
        return NextResponse.json(
          { error: 'WhatsApp could not deliver the verification code. Check the sender configuration.' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        deliveryStatus: 'failed',
        deliveryNotice: sendResult.error,
        devOtp: otpCode,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    }

    return NextResponse.json({
      success: true,
      deliveryStatus: 'sent',
      message: 'Verification code sent to WhatsApp',
      devOtp: isDev ? otpCode : undefined,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error('[Request OTP] Unexpected error:', error);
    return NextResponse.json({ error: 'Could not request a verification code.' }, { status: 500 });
  }
}
