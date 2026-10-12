import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawPhone = (searchParams.get('phone') || '').trim();
    const admin = createAdminClient();

    // 1. Fetch user by phone or fallback to active verified user
    let userQuery = admin
      .from('user_settings')
      .select('user_id, phone_number, phone_verified, monthly_budget_paise, currency, timezone')
      .eq('phone_verified', true);

    if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, '');
      const possiblePhones = [
        rawPhone,
        `+${digits}`,
        digits.length === 10 ? `+91${digits}` : null,
        digits.startsWith('91') ? `+${digits}` : null,
      ].filter(Boolean) as string[];

      userQuery = userQuery.in('phone_number', possiblePhones);
    }

    const { data: userSettings } = await userQuery.limit(1).maybeSingle();

    if (!userSettings) {
      return NextResponse.json({ linked: false, transactions: [] }, { status: 200 });
    }

    // 2. Fetch categories for user
    const { data: categories } = await admin
      .from('categories')
      .select('id, name, color, kind')
      .eq('user_id', userSettings.user_id);

    const categoryMap = new Map((categories || []).map((c) => [c.id, c]));

    // 3. Fetch transactions (latest created first)
    const { data: txList } = await admin
      .from('transactions')
      .select('*')
      .eq('user_id', userSettings.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    const formattedTransactions = (txList || []).map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : null;
      return {
        id: t.id,
        type: t.type,
        amount_paise: Number(t.amount_paise),
        merchant: t.merchant || null,
        note: t.note || null,
        category_name: cat?.name || 'General',
        category_color: cat?.color || '#64748B',
        source: t.source,
        occurred_at: t.occurred_at,
      };
    });

    return NextResponse.json({
      linked: true,
      phone: userSettings.phone_number,
      monthlyBudgetPaise: userSettings.monthly_budget_paise || 2500000,
      currency: userSettings.currency || 'INR',
      timezone: userSettings.timezone || 'Asia/Kolkata',
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, action } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: userSettings } = await admin
      .from('user_settings')
      .select('user_id')
      .eq('phone_number', phone)
      .eq('phone_verified', true)
      .maybeSingle();

    if (!userSettings) {
      return NextResponse.json({ error: 'User not found or unverified' }, { status: 404 });
    }

    if (action === 'update_budget') {
      const { monthlyBudgetPaise } = body;
      await admin
        .from('user_settings')
        .update({ monthly_budget_paise: monthlyBudgetPaise })
        .eq('user_id', userSettings.user_id);

      return NextResponse.json({ success: true, monthlyBudgetPaise });
    }

    if (action === 'add_transaction') {
      const { type, amount_paise, category_name, merchant, note } = body;

      // Find matching category
      const { data: categories } = await admin
        .from('categories')
        .select('id, name')
        .eq('user_id', userSettings.user_id);

      const matchedCat = categories?.find(
        (c) => c.name.toLowerCase() === (category_name || '').toLowerCase()
      );

      const { data: newTx, error: txError } = await admin
        .from('transactions')
        .insert({
          user_id: userSettings.user_id,
          type,
          amount_paise,
          category_id: matchedCat?.id || null,
          merchant: merchant || null,
          note: note || null,
          source: 'web',
          occurred_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (txError) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, transaction: newTx });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Dashboard API] Error in dashboard mutation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
