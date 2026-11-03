import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const AuthActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sign_in'),
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
  z.object({
    action: z.literal('sign_up'),
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
  z.object({
    action: z.literal('demo'),
  }),
]);

function normalizeIdentifier(raw: string): { authEmail: string; displayIdentifier: string; isPhone: boolean } {
  const cleaned = raw.trim();
  const phoneDigits = cleaned.replace(/\D/g, '');
  const isEmail = cleaned.includes('@');

  // If user entered a 10+ digit phone number (e.g., 9876543210 or +919876543210)
  if (!isEmail && phoneDigits.length >= 10) {
    const standard10 = phoneDigits.slice(-10);
    return {
      authEmail: `${standard10}@phone.trackexpenser.app`,
      displayIdentifier: standard10,
      isPhone: true,
    };
  }

  // Standard email address
  return {
    authEmail: cleaned.toLowerCase(),
    displayIdentifier: cleaned,
    isPhone: false,
  };
}

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

    const rawIdentifier = data.identifier || data.email;
    if (!rawIdentifier) {
      return NextResponse.json(
        { error: 'Please enter your email or 10-digit mobile number' },
        { status: 400 }
      );
    }

    const { authEmail, displayIdentifier, isPhone } = normalizeIdentifier(rawIdentifier);

    // Basic validity check
    if (!isPhone && !authEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address or 10-digit mobile number' },
        { status: 400 }
      );
    }

    // 2. Sign In (Email or Mobile Number + Password)
    if (data.action === 'sign_in') {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: data.password,
      });

      if (error || !authData.user) {
        const errorMsg = error?.message?.toLowerCase().includes('invalid login credentials')
          ? (isPhone
              ? 'Incorrect mobile number or password. If you are new, click "Create Account".'
              : 'Incorrect email or password. If you are new, click "Create Account".')
          : error?.message || 'Invalid credentials.';

        return NextResponse.json({ error: errorMsg }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        email: displayIdentifier,
        user: { id: authData.user.id, email: displayIdentifier },
      });
    }

    // 3. Create Account (Email or Mobile Number + Password)
    // Auto-confirmed with Admin client so users can immediately log in without email delays or SMS failures
    if (data.action === 'sign_up') {
      const createPayload: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata?: Record<string, string>;
      } = {
        email: authEmail,
        password: data.password,
        email_confirm: true,
      };

      if (isPhone) {
        createPayload.user_metadata = {
          display_name: displayIdentifier,
          phone: displayIdentifier,
        };
      }

      const { data: newUserData, error: createError } = await admin.auth.admin.createUser(createPayload);

      if (createError) {
        if (createError.message?.toLowerCase().includes('already')) {
          return NextResponse.json(
            {
              error: isPhone
                ? 'An account with this mobile number already exists. Please sign in.'
                : 'An account with this email already exists. Please sign in.',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      // Immediately sign in with session client to set browser session cookies
      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: data.password,
      });

      const user = loginData?.user || newUserData?.user;
      return NextResponse.json({
        success: true,
        email: displayIdentifier,
        user: user ? { id: user.id, email: displayIdentifier } : null,
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
