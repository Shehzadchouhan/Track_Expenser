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

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const txId = searchParams.get('id');
    const rawPhone = (searchParams.get('phone') || '').trim();
    const action = searchParams.get('action'); // 'reset_weekly' | 'reset_monthly' | 'reset_all'
    const admin = createAdminClient();

    // 1. Identify user if phone is provided
    let userId: string | null = null;
    if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, '');
      const possiblePhones = [
        rawPhone,
        `+${digits}`,
        digits.length === 10 ? `+91${digits}` : null,
        digits.startsWith('91') ? `+${digits}` : null,
      ].filter(Boolean) as string[];

      const { data: userSettings } = await admin
        .from('user_settings')
        .select('user_id')
        .in('phone_number', possiblePhones)
        .eq('phone_verified', true)
        .limit(1)
        .maybeSingle();

      if (userSettings) {
        userId = userSettings.user_id;
      }
    }

    // 2. Delete single transaction by ID
    if (txId) {
      let deleteQuery = admin.from('transactions').delete().eq('id', txId);
      if (userId) {
        deleteQuery = deleteQuery.eq('user_id', userId);
      }
      const { error } = await deleteQuery;
      if (error) {
        console.error('[Dashboard API] Failed to delete transaction:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deletedId: txId });
    }

    // 3. Reset transactions by cycle
    if (action) {
      if (!userId) {
        const { data: fallbackUser } = await admin
          .from('user_settings')
          .select('user_id')
          .eq('phone_verified', true)
          .limit(1)
          .maybeSingle();
        if (fallbackUser) {
          userId = fallbackUser.user_id;
        } else {
          return NextResponse.json({ error: 'User not found or unverified' }, { status: 404 });
        }
      }

      const now = new Date();

      if (action === 'reset_weekly') {
        // Start of current week (Monday 00:00:00)
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const { error } = await admin
          .from('transactions')
          .delete()
          .eq('user_id', userId)
          .gte('occurred_at', startOfWeek.toISOString());

        if (error) {
          console.error('[Dashboard API] Failed to reset weekly transactions:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'reset_weekly' });
      }

      if (action === 'reset_monthly') {
        // Start of current month (1st of month 00:00:00)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        const { error } = await admin
          .from('transactions')
          .delete()
          .eq('user_id', userId)
          .gte('occurred_at', startOfMonth.toISOString());

        if (error) {
          console.error('[Dashboard API] Failed to reset monthly transactions:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'reset_monthly' });
      }

      if (action === 'reset_all') {
        const { error } = await admin
          .from('transactions')
          .delete()
          .eq('user_id', userId);

        if (error) {
          console.error('[Dashboard API] Failed to reset all transactions:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'reset_all' });
      }

      return NextResponse.json({ error: 'Unknown reset action' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Missing id or action parameter' }, { status: 400 });
  } catch (error) {
    console.error('[Dashboard API] Error in dashboard delete:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

