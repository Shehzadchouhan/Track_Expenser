import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  // If credentials are not yet added in .env.local, use fallback to avoid browser crashes
  if (!url || !key) {
    return createBrowserClient<Database>(
      'https://placeholder-project.supabase.co',
      'placeholder-anon-key'
    );
  }

  return createBrowserClient<Database>(url, key);
}
