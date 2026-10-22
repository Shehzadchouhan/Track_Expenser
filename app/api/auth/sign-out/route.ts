import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[Sign out] Failed to end Supabase session:', error);
      return NextResponse.json({ error: 'Could not sign out. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Sign out] Unexpected error:', error);
    return NextResponse.json({ error: 'Could not sign out. Please try again.' }, { status: 500 });
  }
}
