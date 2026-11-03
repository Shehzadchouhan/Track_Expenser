import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const rawType = requestUrl.searchParams.get('type');
  const errorParam = requestUrl.searchParams.get('error');
  const errorDesc = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/';

  // If Supabase returned an explicit error (e.g. link expired)
  if (errorParam) {
    console.error('[Auth Callback] Supabase returned error:', errorParam, errorDesc);
    const redirectUrl = new URL('/', requestUrl.origin);
    redirectUrl.searchParams.set('auth_error', errorDesc || errorParam);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
    console.error('[Auth Callback] Code exchange error:', error);
    return NextResponse.redirect(new URL('/?auth_error=verification_failed', requestUrl.origin));
  }

  if (tokenHash) {
    const otpType: EmailOtpType =
      (rawType as EmailOtpType) || (next.includes('reset-password') ? 'recovery' : 'email');
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
    console.error('[Auth Callback] Token hash verification error:', error);
    return NextResponse.redirect(new URL('/?auth_error=verification_failed', requestUrl.origin));
  }

  // If neither code nor token_hash was in query params, it is likely an implicit flow redirect
  // containing client-only hash fragments (#access_token=...&refresh_token=...).
  // Hash fragments are never sent to the server in HTTP requests, so we render a tiny
  // client landing page that preserves the hash and forwards it to the root page.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
</head>
<body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #09090b; color: #fff;">
  <div style="text-align: center; padding: 20px;">
    <p style="font-size: 18px; font-weight: 600; margin-bottom: 6px;">Signing you in to Track Expenser...</p>
    <p style="font-size: 14px; color: #a1a1aa; margin: 0;">कृपया प्रतीक्षा करें, आपको साइन इन किया जा रहा है...</p>
  </div>
  <script>
    if (window.location.hash) {
      window.location.href = '/' + window.location.hash;
    } else {
      window.location.href = '/';
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
