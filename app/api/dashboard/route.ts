import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { MAX_PAISE, MIN_PAISE } from '@/lib/constants';

const DashboardMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_budget'),
    monthlyBudgetPaise: z.number().int().min(MIN_PAISE).max(MAX_PAISE),
  }),
  z.object({
    action: z.literal('update_starting_balance'),
    startingBalancePaise: z.number().int().min(0).max(MAX_PAISE),
  }),
  z.object({
    action: z.literal('add_transaction'),
    type: z.enum(['income', 'expense']),
    amount_paise: z.number().int().min(MIN_PAISE).max(MAX_PAISE),
    category_name: z.string().trim().min(1).max(40),
    merchant: z.string().trim().max(100).nullable().optional(),
    note: z.string().trim().max(280).nullable().optional(),
    occurred_at: z.string().datetime().optional(),
  }),
]);

const ResetActionSchema = z.enum(['reset_weekly', 'reset_monthly', 'reset_all']);

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Sign in to access your account.' }, { status: 401 });
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const admin = createAdminClient();
    const { data: userSettings, error: settingsError } = await admin
      .from('user_settings')
      .select('user_id, phone_number, phone_verified, monthly_budget_paise, starting_balance_paise, currency, timezone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('[Dashboard API] Failed to fetch user settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
    }

    if (!userSettings?.phone_verified) {
      return NextResponse.json({ linked: false, transactions: [] });
    }

    const [{ data: categories, error: categoriesError }, { data: txList, error: txError }] =
      await Promise.all([
        admin
          .from('categories')
          .select('id, name, color, kind')
          .eq('user_id', user.id),
        admin
          .from('transactions')
          .select('id, type, amount_paise, merchant, note, category_id, source, occurred_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

    if (categoriesError || txError) {
      console.error('[Dashboard API] Failed to fetch account data:', categoriesError ?? txError);
      return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
    }

    const categoryMap = new Map((categories ?? []).map((category) => [category.id, category]));
    const transactions = (txList ?? []).map((transaction) => {
      const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null;
      return {
        id: transaction.id,
        type: transaction.type,
        amount_paise: Number(transaction.amount_paise),
        merchant: transaction.merchant,
        note: transaction.note,
        category_name: category?.name ?? 'General',
        category_color: category?.color ?? '#64748B',
        source: transaction.source,
        occurred_at: transaction.occurred_at,
      };
    });

    return NextResponse.json({
      linked: true,
      phone: userSettings.phone_number,
      monthlyBudgetPaise: userSettings.monthly_budget_paise ?? 2500000,
      startingBalancePaise: userSettings.starting_balance_paise,
      currency: userSettings.currency,
      timezone: userSettings.timezone,
      transactions,
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const parseResult = DashboardMutationSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const mutation = parseResult.data;

    if (mutation.action === 'update_budget') {
      const { error } = await admin
        .from('user_settings')
        .upsert(
          { user_id: user.id, monthly_budget_paise: mutation.monthlyBudgetPaise },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('[Dashboard API] Failed to update budget:', error);
        return NextResponse.json({ error: 'Could not save the budget.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        monthlyBudgetPaise: mutation.monthlyBudgetPaise,
      });
    }

    if (mutation.action === 'update_starting_balance') {
      const { error } = await admin
        .from('user_settings')
        .upsert(
          { user_id: user.id, starting_balance_paise: mutation.startingBalancePaise },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('[Dashboard API] Failed to update starting balance:', error);
        return NextResponse.json({ error: 'Could not save the starting balance.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        startingBalancePaise: mutation.startingBalancePaise,
      });
    }

    const { data: categories, error: categoriesError } = await admin
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id);

    if (categoriesError) {
      console.error('[Dashboard API] Failed to fetch categories:', categoriesError);
      return NextResponse.json({ error: 'Could not save the transaction.' }, { status: 500 });
    }

    const matchedCategory = categories?.find(
      (category) => category.name.toLowerCase() === mutation.category_name.toLowerCase()
    );
    const { data: newTransaction, error: transactionError } = await admin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: mutation.type,
        amount_paise: mutation.amount_paise,
        category_id: matchedCategory?.id ?? null,
        merchant: mutation.merchant || null,
        note: mutation.note || null,
        source: 'web',
        occurred_at: mutation.occurred_at ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (transactionError || !newTransaction) {
      console.error('[Dashboard API] Failed to create transaction:', transactionError);
      return NextResponse.json({ error: 'Could not save the transaction.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, transaction: newTransaction });
  } catch (error) {
    console.error('[Dashboard API] Error in dashboard mutation:', error);
    return NextResponse.json({ error: 'Could not save the requested change.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const transactionId = request.nextUrl.searchParams.get('id');
    const rawAction = request.nextUrl.searchParams.get('action');
    const admin = createAdminClient();

    if (transactionId) {
      const idResult = z.string().uuid().safeParse(transactionId);
      if (!idResult.success) {
        return NextResponse.json({ error: 'Invalid transaction ID.' }, { status: 400 });
      }

      const { error } = await admin
        .from('transactions')
        .delete()
        .eq('id', idResult.data)
        .eq('user_id', user.id);

      if (error) {
        console.error('[Dashboard API] Failed to delete transaction:', error);
        return NextResponse.json({ error: 'Could not delete this transaction.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, deletedId: idResult.data });
    }

    const actionResult = ResetActionSchema.safeParse(rawAction);
    if (!actionResult.success) {
      return NextResponse.json(
        { error: rawAction ? 'Unknown reset action.' : 'Missing transaction ID or reset action.' },
        { status: 400 }
      );
    }

    const action = actionResult.data;
    let query = admin.from('transactions').delete().eq('user_id', user.id);

    if (action === 'reset_weekly') {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      query = query.gte('occurred_at', startOfWeek.toISOString());
    } else if (action === 'reset_monthly') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      query = query.gte('occurred_at', startOfMonth.toISOString());
    }

    const { error } = await query;
    if (error) {
      console.error(`[Dashboard API] Failed to ${action}:`, error);
      return NextResponse.json({ error: 'Could not reset transactions.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('[Dashboard API] Error in dashboard delete:', error);
    return NextResponse.json({ error: 'Could not complete the requested operation.' }, { status: 500 });
  }
}
