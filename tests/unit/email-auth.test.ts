import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestEmailOtp } from '@/app/api/auth/email/request-otp/route';
import { POST as verifyEmailOtp } from '@/app/api/auth/email/verify-otp/route';
import { GET as authCallback } from '@/app/auth/callback/route';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

describe('Email Authentication Routes', () => {
  const signInWithOtp = vi.fn();
  const verifyOtp = vi.fn();
  const exchangeCodeForSession = vi.fn();

  const supabaseClient = {
    auth: {
      signInWithOtp,
      verifyOtp,
      exchangeCodeForSession,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);
  });

  describe('POST /api/auth/email/request-otp', () => {
    it('rejects invalid email formats', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/email/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const response = await requestEmailOtp(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('valid email');
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it('sends email OTP when email is valid', async () => {
      signInWithOtp.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/auth/email/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

      const response = await requestEmailOtp(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          options: expect.objectContaining({ shouldCreateUser: true }),
        })
      );
    });

    it('handles Supabase errors gracefully', async () => {
      signInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });

      const request = new NextRequest('http://localhost:3000/api/auth/email/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

      const response = await requestEmailOtp(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Rate limit exceeded');
    });
  });

  describe('POST /api/auth/email/verify-otp', () => {
    it('rejects missing or short token', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', token: '123' }),
      });

      const response = await verifyEmailOtp(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it('verifies valid token and establishes session', async () => {
      verifyOtp.mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'user@example.com' },
          session: { access_token: 'xyz' },
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', token: '123456' }),
      });

      const response = await verifyEmailOtp(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('user@example.com');
      expect(verifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: '123456',
        type: 'email',
      });
    });
  });

  describe('GET /auth/callback', () => {
    it('exchanges code for session and redirects to origin root', async () => {
      exchangeCodeForSession.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/auth/callback?code=test-code');
      const response = await authCallback(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
      expect(exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    });

    it('redirects with error parameter when code exchange fails', async () => {
      exchangeCodeForSession.mockResolvedValue({ error: { message: 'Invalid code' } });

      const request = new NextRequest('http://localhost:3000/auth/callback?code=bad-code');
      const response = await authCallback(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('auth_error=verification_failed');
    });
  });
});
