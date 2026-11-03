import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

describe('POST /api/auth/login', () => {
  const signInWithPassword = vi.fn();
  const createUser = vi.fn();

  const supabaseClient = {
    auth: {
      signInWithPassword,
    },
  };

  const adminClient = {
    auth: {
      admin: {
        createUser,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
  });

  it('rejects invalid action or parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' }),
    });

    const response = await loginRoute(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('handles 1-Click Demo login successfully', async () => {
    createUser.mockResolvedValue({ data: { user: { id: 'demo-user-id' } }, error: null });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'demo-user-id', email: 'demo@trackexpenser.app' } },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demo' }),
    });

    const response = await loginRoute(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isDemo).toBe(true);
    expect(data.user.email).toBe('demo@trackexpenser.app');
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'demo@trackexpenser.app',
      password: 'DemoPassword@2026',
    });
  });

  it('handles sign in with valid credentials', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sign_in',
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await loginRoute(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('test@example.com');
  });

  it('returns 401 when sign in fails', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sign_in',
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    });

    const response = await loginRoute(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid login credentials');
  });

  it('auto-confirms email and signs in on sign_up', async () => {
    createUser.mockResolvedValue({
      data: { user: { id: 'new-user', email: 'new@example.com' } },
      error: null,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'new-user', email: 'new@example.com' } },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sign_up',
        email: 'new@example.com',
        password: 'securepassword123',
      }),
    });

    const response = await loginRoute(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'securepassword123',
      email_confirm: true,
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'securepassword123',
    });
  });
});
