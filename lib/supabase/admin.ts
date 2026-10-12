import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Server-only Supabase client equipped with the service role key.
 * 
 * ⚠️ WARNING: NEVER expose this client to the browser or use it in client components.
 * This client bypasses PostgreSQL Row Level Security (RLS) and is strictly reserved for:
 * 1. Webhook handlers (e.g. WhatsApp / Meta Cloud API) where no user session exists.
 * 2. Background jobs & server-side verification pipelines.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
