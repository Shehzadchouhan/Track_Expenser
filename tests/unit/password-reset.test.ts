import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestReset } from '@/app/api/auth/reset-password/route';
import { POST as updatePassword } from '@/app/api/auth/update-password/route';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

describe('Password Reset Routes', () => {
  const resetPasswordForEmail = vi.fn();
  const getUser = vi.fn();
  const updateUser = vi.fn();

  const supabaseClient = {
    auth: {
      resetPasswordForEmail,
      getUser,
      updateUser,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);
  });

  describe('POST /api/auth/reset-password', () => {
    it('rejects invalid email formats', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad-email' }),
      });

      const response = await requestReset(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('valid email');
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('sends reset email when email is valid', async () => {
      resetPasswordForEmail.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

      const response = await requestReset(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
        })
      );
    });

    it('handles Supabase rate limit gracefully', async () => {
      resetPasswordForEmail.mockResolvedValue({
        error: { message: 'email rate limit exceeded' },
      });

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

      const response = await requestReset(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Too many requests');
    });
  });

  describe('POST /api/auth/update-password', () => {
    it('rejects passwords shorter than 6 characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123' }),
      });

      const response = await updatePassword(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('at least 6 characters');
    });

    it('returns 401 when user is not authenticated', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });

      const request = new NextRequest('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'newpassword123' }),
      });

      const response = await updatePassword(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Session expired');
    });

    it('updates password when user has active session', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null,
      });
      updateUser.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'newpassword123' }),
      });

      const response = await updatePassword(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
    });
  });
});
