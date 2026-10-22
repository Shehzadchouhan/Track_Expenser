import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestOtp } from '@/app/api/phone/request-otp/route';
import { POST as verifyOtp } from '@/app/api/phone/verify-otp/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { whatsappClient } from '@/lib/whatsapp/client';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/whatsapp/client', () => ({
  whatsappClient: {
    sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Phone authentication routes', () => {
  const getUser = vi.fn();
  const establishSession = vi.fn();
  const supabaseClient = {
    auth: {
      getUser,
      verifyOtp: establishSession,
    },
  };
  const consumeOtp = vi.fn();
  const reserveOtp = vi.fn();
  const createUser = vi.fn();
  const generateLink = vi.fn();
  const upsertSettings = vi.fn();
  const adminClient = {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      admin: {
        createUser,
        generateLink,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    establishSession.mockResolvedValue({ error: null });
    adminClient.rpc.mockImplementation((name: string) => ({
      single: name === 'consume_phone_otp' ? consumeOtp : reserveOtp,
    }));
    adminClient.from.mockReturnValue({ upsert: upsertSettings });
    upsertSettings.mockResolvedValue({ error: null });
    vi.mocked(whatsappClient.sendTextMessage).mockResolvedValue({ success: true });
  });

  it('requires a session before a phone can be linked to an account', async () => {
    const response = await requestOtp(
      new NextRequest('http://localhost:3000/api/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+919876543210', intent: 'link' }),
      })
    );

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects rate-limited OTP requests', async () => {
    reserveOtp.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 300 },
      error: null,
    });

    const response = await requestOtp(
      new NextRequest('http://localhost:3000/api/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+919876543210' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('300');
    expect(body.retryAfterSeconds).toBe(300);
    expect(whatsappClient.sendTextMessage).not.toHaveBeenCalled();
  });

  it('does not sign in when the OTP is incorrect', async () => {
    consumeOtp.mockResolvedValue({
      data: {
        verification_status: 'incorrect',
        verified_user_id: null,
        remaining_attempts: 4,
        verification_intent: 'sign_in',
      },
      error: null,
    });

    const response = await verifyOtp(
      new NextRequest('http://localhost:3000/api/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+919876543210', otp_code: '000000' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('4 attempts remaining');
    expect(establishSession).not.toHaveBeenCalled();
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  it('establishes a Supabase session after successful phone verification', async () => {
    consumeOtp.mockResolvedValue({
      data: {
        verification_status: 'verified',
        verified_user_id: 'user-123',
        remaining_attempts: 0,
        verification_intent: 'sign_in',
      },
      error: null,
    });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'one-time-token-hash' } },
      error: null,
    });

    const response = await verifyOtp(
      new NextRequest('http://localhost:3000/api/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+919876543210', otp_code: '123456' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(upsertSettings).toHaveBeenCalledWith(
      {
        user_id: 'user-123',
        phone_number: '+919876543210',
        phone_verified: true,
      },
      { onConflict: 'user_id' }
    );
    expect(generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'phone_919876543210@trackexpenser.local',
    });
    expect(establishSession).toHaveBeenCalledWith({
      token_hash: 'one-time-token-hash',
      type: 'magiclink',
    });
  });
});
