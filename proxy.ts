import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - legacy (legacy directory)
     * - static images
     */
    '/((?!_next/static|_next/image|favicon.ico|legacy|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
