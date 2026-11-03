import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const AuthActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sign_in'),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
  z.object({
    action: z.literal('sign_up'),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
  z.object({
    action: z.literal('demo'),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AuthActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid parameters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const admin = createAdminClient();
    const data = parsed.data;

    // 1. One-Click Instant Demo Login
    if (data.action === 'demo') {
      const demoEmail = 'demo@trackexpenser.app';
      const demoPassword = 'DemoPassword@2026';

      // Ensure demo account exists with email confirmed
      try {
        await admin.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { display_name: 'Demo Account' },
        });
      } catch {
        // Already exists, ignore
      }

      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (loginError || !authData.user) {
        console.error('[Demo Auth] Error:', loginError);
        return NextResponse.json(
          { error: loginError?.message || 'Could not start demo session.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        isDemo: true,
        email: demoEmail,
        user: { id: authData.user.id, email: authData.user.email },
      });
    }

    // 2. Email + Password Sign In
    if (data.action === 'sign_in') {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error || !authData.user) {
        return NextResponse.json(
          { error: error?.message || 'Invalid email or password.' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        email: data.email,
        user: { id: authData.user.id, email: authData.user.email },
      });
    }

    // 3. Email + Password Sign Up (Auto-confirmed with Admin client to bypass SMTP rate limits)
    if (data.action === 'sign_up') {
      const { data: newUserData, error: createError } = await admin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });

      if (createError) {
        // If user already registered, inform user to sign in
        if (createError.message?.toLowerCase().includes('already')) {
          return NextResponse.json(
            { error: 'An account with this email already exists. Please sign in.' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      // Immediately sign in with session client to set browser session cookies
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      const user = loginData.user || newUserData.user;
      return NextResponse.json({
        success: true,
        email: data.email,
        user: user ? { id: user.id, email: user.email } : null,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Auth Login] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Authentication failed. Please check connection and try again.' },
      { status: 500 }
    );
  }
}
