import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { MAX_PAISE, MIN_PAISE, DEFAULT_CATEGORIES } from '@/lib/constants';

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
    action: z.literal('update_savings_upi'),
    savings_upi_id: z.string().trim().max(100),
  }),
  z.object({
    action: z.literal('update_account_goal'),
    account_id: z.string().min(1),
    target_goal_paise: z.number().int().min(0).max(MAX_PAISE).nullable(),
  }),
  z.object({
    action: z.literal('add_transaction'),
    type: z.enum(['income', 'expense', 'transfer']),
    amount_paise: z.number().int().min(MIN_PAISE).max(MAX_PAISE),
    account_id: z.string().min(1).nullable().optional(),
    transfer_to_account_id: z.string().min(1).nullable().optional(),
    source_account_name: z.string().trim().max(50).nullable().optional(),
    transfer_to_account_name: z.string().trim().max(50).nullable().optional(),
    category_name: z.string().trim().min(1).max(40).optional(),
    merchant: z.string().trim().max(100).nullable().optional(),
    note: z.string().trim().max(280).nullable().optional(),
    occurred_at: z.string().optional(),
  }),
  z.object({
    action: z.literal('reconcile_account'),
    account_id: z.string().min(1),
    actual_balance_paise: z.number().int().min(0).max(MAX_PAISE),
  }),
  z.object({
    action: z.literal('create_account'),
    name: z.string().trim().min(1).max(50),
    type: z.enum(['bank', 'cash', 'wallet']).default('bank'),
    purpose: z.enum(['spending', 'savings']).default('spending'),
    opening_balance_paise: z.number().int().min(-MAX_PAISE).max(MAX_PAISE).default(0),
    target_goal_paise: z.number().int().min(0).max(MAX_PAISE).nullable().optional(),
  }),
  z.object({
    action: z.literal('update_account'),
    account_id: z.string().min(1),
    name: z.string().trim().min(1).max(50).optional(),
    type: z.enum(['bank', 'cash', 'wallet']).optional(),
    target_goal_paise: z.number().int().min(0).max(MAX_PAISE).nullable().optional(),
  }),
  z.object({
    action: z.literal('delete_account'),
    account_id: z.string().min(1),
    transfer_to_account_id: z.string().min(1).optional(),
  }),
]);

const ResetActionSchema = z.enum(['reset_weekly', 'reset_monthly', 'reset_all']);

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Sign in to access your account.' }, { status: 401 });
}

const isUuidString = (id?: string | null): boolean =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function formatTxMeta(meta: {
  type: 'income' | 'expense' | 'transfer';
  from?: string | null;
  to?: string | null;
  fromName?: string | null;
  toName?: string | null;
}) {
  return `[TX_META:type=${meta.type};from=${meta.from || ''};to=${meta.to || ''};fromName=${encodeURIComponent(meta.fromName || '')};toName=${encodeURIComponent(meta.toName || '')}]`;
}

function parseTxMeta(note?: string | null): {
  type?: 'income' | 'expense' | 'transfer';
  from?: string;
  to?: string;
  fromName?: string;
  toName?: string;
  cleanNote: string;
} {
  if (!note) return { cleanNote: '' };
  const match = note.match(/\[TX_META:type=([^;]+);from=([^;]*);to=([^;]*);fromName=([^;]*);toName=([^;\]]*)\]/);
  if (!match) return { cleanNote: note };
  try {
    return {
      type: match[1] as any,
      from: match[2] || undefined,
      to: match[3] || undefined,
      fromName: match[4] ? decodeURIComponent(match[4]) : undefined,
      toName: match[5] ? decodeURIComponent(match[5]) : undefined,
      cleanNote: note.replace(match[0], '').trim(),
    };
  } catch {
    return {
      type: match[1] as any,
      from: match[2] || undefined,
      to: match[3] || undefined,
      fromName: match[4] || undefined,
      toName: match[5] || undefined,
      cleanNote: note.replace(match[0], '').trim(),
    };
  }
}

function resolveAccountForTx(
  id: string | null | undefined,
  merchantOrNote: string,
  bankAcc: any,
  cashAcc: any,
  onlineVaultAcc: any,
  cashVaultAcc: any,
  role: 'from' | 'to'
): string {
  if (id === 'default-cash-vault' || (id && isUuidString(id) && id === cashVaultAcc?.id)) {
    return cashVaultAcc?.id ?? 'default-cash-vault';
  }
  if (id === 'default-online-vault' || (id && isUuidString(id) && id === onlineVaultAcc?.id)) {
    return onlineVaultAcc?.id ?? 'default-online-vault';
  }
  if (id === 'default-cash' || (id && isUuidString(id) && id === cashAcc?.id)) {
    return cashAcc?.id ?? 'default-cash';
  }
  if (id === 'default-bank' || (id && isUuidString(id) && id === bankAcc?.id)) {
    return bankAcc?.id ?? 'default-bank';
  }

  const lower = merchantOrNote.toLowerCase();
  if (role === 'to') {
    if (lower.includes('cash vault') || (lower.includes('vault') && lower.includes('cash'))) {
      return cashVaultAcc?.id ?? 'default-cash-vault';
    }
    if (lower.includes('online vault') || lower.includes('savings vault') || lower.includes('vault') || lower.includes('savings')) {
      return onlineVaultAcc?.id ?? 'default-online-vault';
    }
    if (lower.includes('cash') || lower.includes('atm')) {
      return cashAcc?.id ?? 'default-cash';
    }
    return bankAcc?.id ?? 'default-bank';
  } else {
    // role === 'from'
    if (lower.includes('from cash vault') || lower.includes('withdrawal from cash vault')) {
      return cashVaultAcc?.id ?? 'default-cash-vault';
    }
    if (lower.includes('from online vault') || lower.includes('from savings vault') || lower.includes('withdrawal from online vault')) {
      return onlineVaultAcc?.id ?? 'default-online-vault';
    }
    if (lower.includes('cash vault') || (lower.includes('cash') && (lower.includes('deposit') || lower.includes('top-up')))) {
      return cashAcc?.id ?? 'default-cash';
    }
    if (lower.includes('cash')) {
      return cashAcc?.id ?? 'default-cash';
    }
    return bankAcc?.id ?? 'default-bank';
  }
}

async function safeInsertTransaction(admin: any, txPayload: Record<string, any>) {
  const sanitized = { ...txPayload };
  if (sanitized.account_id && !isUuidString(sanitized.account_id)) {
    delete sanitized.account_id;
  }
  if (sanitized.transfer_to_account_id && !isUuidString(sanitized.transfer_to_account_id)) {
    delete sanitized.transfer_to_account_id;
  }

  const insert = (payload: Record<string, any>) =>
    admin.from('transactions').insert(payload).select('id').single();
  const result = await insert(sanitized);
  if (!result.error) return result;

  const fallbackPayload = { ...sanitized };
  if (result.error.code === '42703') {
    delete fallbackPayload.account_id;
    delete fallbackPayload.transfer_to_account_id;
  } else if (result.error.code === '23514' && fallbackPayload.type === 'transfer') {
    delete fallbackPayload.account_id;
    delete fallbackPayload.transfer_to_account_id;
    fallbackPayload.type = 'expense';
  } else {
    return result;
  }

  const fallbackResult = await insert(fallbackPayload);
  if (!fallbackResult.error) return fallbackResult;

  if (fallbackResult.error.code === '23514' && fallbackPayload.type === 'transfer') {
    delete fallbackPayload.account_id;
    delete fallbackPayload.transfer_to_account_id;
    fallbackPayload.type = 'expense';
    return insert(fallbackPayload);
  }

  return fallbackResult;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const admin = createAdminClient();

    // Resilient user_settings query: try full columns, fallback to base columns if new columns don't exist
    let userSettings: any = null;
    const settingsRes = await admin
      .from('user_settings')
      .select('user_id, phone_number, phone_verified, monthly_budget_paise, starting_balance_paise, savings_upi_id, currency, timezone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsRes.error) {
      const baseSettingsRes = await admin
        .from('user_settings')
        .select('user_id, phone_number, phone_verified, monthly_budget_paise, currency, timezone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (baseSettingsRes.error) {
        console.error('[Dashboard API] Failed to fetch base user settings:', baseSettingsRes.error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
      }
      userSettings = baseSettingsRes.data;
    } else {
      userSettings = settingsRes.data;
    }

    let activeSettings = userSettings;
    if (!activeSettings) {
      try {
        const { data: createdSettings } = await admin
          .from('user_settings')
          .upsert({ user_id: user.id }, { onConflict: 'user_id' })
          .select('user_id, phone_number, phone_verified, monthly_budget_paise, currency, timezone')
          .single();
        activeSettings = createdSettings;
      } catch {
        activeSettings = {
          user_id: user.id,
          phone_number: null,
          phone_verified: false,
          monthly_budget_paise: 2500000,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        };
      }
    }

    let accounts: any[] | null = null;
    let accountsError: any = null;
    let categories: any[] | null = null;
    let categoriesError: any = null;

    try {
      const [accRes, catRes] = await Promise.all([
        admin
          .from('accounts')
          .select('id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false }),
        admin
          .from('categories')
          .select('id, name, color, kind')
          .eq('user_id', user.id),
      ]);

      categories = catRes.data;
      categoriesError = catRes.error;

      if (accRes.error) {
        // Fallback without target_goal_paise in case column doesn't exist
        const baseAccRes = await admin
          .from('accounts')
          .select('id, name, type, purpose, opening_balance_paise, is_default')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });

        if (baseAccRes.error) {
          accountsError = baseAccRes.error;
        } else {
          accounts = baseAccRes.data;
        }
      } else {
        accounts = accRes.data;
      }
    } catch (err) {
      accountsError = err;
    }

    const defaultFallbackAccounts = [
      {
        id: 'default-bank',
        user_id: user.id,
        name: 'Bank / UPI',
        type: 'bank' as const,
        purpose: 'spending' as const,
        opening_balance_paise: activeSettings?.starting_balance_paise ?? 0,
        target_goal_paise: null,
        is_default: true,
      },
      {
        id: 'default-cash',
        user_id: user.id,
        name: 'Cash',
        type: 'cash' as const,
        purpose: 'spending' as const,
        opening_balance_paise: 0,
        target_goal_paise: null,
        is_default: false,
      },
      {
        id: 'default-online-vault',
        user_id: user.id,
        name: 'Online Vault',
        type: 'bank' as const,
        purpose: 'savings' as const,
        opening_balance_paise: 0,
        target_goal_paise: 5000000,
        is_default: false,
      },
      {
        id: 'default-cash-vault',
        user_id: user.id,
        name: 'Cash Vault',
        type: 'cash' as const,
        purpose: 'savings' as const,
        opening_balance_paise: 0,
        target_goal_paise: 2000000,
        is_default: false,
      },
    ];

    if (accountsError) {
      accounts = defaultFallbackAccounts;
    } else if (!accounts || accounts.length === 0) {
      try {
        const { data: seededAccounts } = await admin
          .from('accounts')
          .insert(defaultFallbackAccounts.map(({ id: _, ...rest }) => rest))
          .select('id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default');
        if (seededAccounts && seededAccounts.length > 0) {
          accounts = seededAccounts;
        } else {
          accounts = defaultFallbackAccounts;
        }
      } catch {
        accounts = defaultFallbackAccounts;
      }
    }

    if (!categories || categories.length === 0) {
      try {
        const seedItems = DEFAULT_CATEGORIES.map((cat) => ({
          user_id: user.id,
          name: cat.name,
          color: cat.color,
          kind: cat.kind,
        }));
        const { data: seeded } = await admin.from('categories').insert(seedItems).select('id, name, color, kind');
        if (seeded) {
          categories = seeded;
        }
      } catch (err) {
        console.warn('[Dashboard API] Categories seed warning:', err);
      }
    }

    if (categoriesError && !categories) {
      categories = DEFAULT_CATEGORIES.map((c, i) => ({ id: `cat-${i}`, name: c.name, color: c.color, kind: c.kind }));
    }

    // Fetch the recent feed and full balance history concurrently.
    const [txRes, allTxRes] = await Promise.all([
      admin
        .from('transactions')
        .select('id, type, amount_paise, merchant, note, category_id, account_id, transfer_to_account_id, source, occurred_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('transactions')
        .select('type, amount_paise, account_id, transfer_to_account_id, merchant, note')
        .eq('user_id', user.id),
    ]);

    let txList: any[] = [];
    if (txRes.error) {
      const fallbackTxRes = await admin
        .from('transactions')
        .select('id, type, amount_paise, merchant, note, category_id, source, occurred_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fallbackTxRes.error) {
        console.error('[Dashboard API] Failed to fetch transactions:', fallbackTxRes.error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
      }
      txList = (fallbackTxRes.data ?? []).map((t: any) => ({
        ...t,
        account_id: null,
        transfer_to_account_id: null,
      }));
    } else {
      txList = txRes.data ?? [];
    }

    let allUserTx: any[] = [];
    if (allTxRes.error) {
      const fallbackAllTx = await admin
        .from('transactions')
        .select('type, amount_paise, merchant, note')
        .eq('user_id', user.id);
      if (fallbackAllTx.error) {
        console.error('[Dashboard API] Failed to fetch transaction balances:', fallbackAllTx.error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data.' }, { status: 500 });
      }
      allUserTx = fallbackAllTx.data ?? [];
    } else {
      allUserTx = allTxRes.data ?? [];
    }

    // Compute live balance for each account using all user transactions
    const accountMap = new Map((accounts ?? []).map((acc) => [acc.id, acc]));
    const accountBalances = new Map<string, number>();
    (accounts ?? []).forEach((acc) => {
      accountBalances.set(acc.id, Number(acc.opening_balance_paise));
    });

    const bankAcc = (accounts ?? []).find((a) => a.is_default || (a.purpose === 'spending' && a.type === 'bank'));
    const cashAcc = (accounts ?? []).find((a) => a.purpose === 'spending' && a.type === 'cash');
    const onlineVaultAcc = (accounts ?? []).find((a) => a.purpose === 'savings' && (a.type === 'bank' || a.name.toLowerCase().includes('online')));
    const cashVaultAcc = (accounts ?? []).find((a) => a.purpose === 'savings' && (a.type === 'cash' || a.name.toLowerCase().includes('cash')));

    allUserTx.forEach((tx) => {
      const amt = Number(tx.amount_paise);
      const parsedMeta = parseTxMeta(tx.note);

      let effectiveType: 'income' | 'expense' | 'transfer' = parsedMeta.type || tx.type;
      let fromAccId = parsedMeta.from || tx.account_id;
      let toAccId = parsedMeta.to || tx.transfer_to_account_id;
      const merchantOrNote = `${tx.merchant || ''} ${tx.note || ''}`.toLowerCase();

      // Resolve fromAccId if missing or unmapped
      if (!fromAccId || !accountBalances.has(fromAccId)) {
        fromAccId = resolveAccountForTx(fromAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'from');
      }

      // If transfer, resolve toAccId if missing or unmapped
      if (effectiveType === 'transfer' && (!toAccId || !accountBalances.has(toAccId))) {
        toAccId = resolveAccountForTx(toAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'to');
      }

      // Legacy auto-detection for older records:
      // If a transaction has merchant like "Deposit to Cash Vault" or "Deposit into Cash Vault"
      // or "Deposit to Online Vault" (or "Withdrawal from ..."), reconstruct the transfer
      if (effectiveType !== 'transfer') {
        if (merchantOrNote.includes('deposit to cash vault') || merchantOrNote.includes('deposit into cash vault')) {
          effectiveType = 'transfer';
          fromAccId = cashAcc?.id ?? 'default-cash';
          toAccId = cashVaultAcc?.id ?? 'default-cash-vault';
        } else if (merchantOrNote.includes('withdrawal from cash vault') || merchantOrNote.includes('withdraw from cash vault')) {
          effectiveType = 'transfer';
          fromAccId = cashVaultAcc?.id ?? 'default-cash-vault';
          toAccId = cashAcc?.id ?? 'default-cash';
        } else if (merchantOrNote.includes('deposit to online vault') || merchantOrNote.includes('deposit into online vault') || merchantOrNote.includes('deposit to savings vault')) {
          effectiveType = 'transfer';
          fromAccId = bankAcc?.id ?? 'default-bank';
          toAccId = onlineVaultAcc?.id ?? 'default-online-vault';
        } else if (merchantOrNote.includes('withdrawal from online vault') || merchantOrNote.includes('withdraw from online vault') || merchantOrNote.includes('withdrawal from savings vault')) {
          effectiveType = 'transfer';
          fromAccId = onlineVaultAcc?.id ?? 'default-online-vault';
          toAccId = bankAcc?.id ?? 'default-bank';
        } else if (merchantOrNote.includes('cash vault reconciliation')) {
          fromAccId = cashVaultAcc?.id ?? 'default-cash-vault';
        } else if (merchantOrNote.includes('online vault reconciliation') || merchantOrNote.includes('savings vault reconciliation')) {
          fromAccId = onlineVaultAcc?.id ?? 'default-online-vault';
        }
      }

      if (effectiveType === 'income' && fromAccId) {
        const cur = accountBalances.get(fromAccId) ?? 0;
        accountBalances.set(fromAccId, cur + amt);
      } else if (effectiveType === 'expense' && fromAccId) {
        const cur = accountBalances.get(fromAccId) ?? 0;
        accountBalances.set(fromAccId, cur - amt);
      } else if (effectiveType === 'transfer') {
        if (fromAccId && toAccId && fromAccId === toAccId) {
          // Same source to same destination transfer: top-up / deposit!
          const cur = accountBalances.get(fromAccId) ?? 0;
          accountBalances.set(fromAccId, cur + amt);
        } else {
          if (fromAccId) {
            const curFrom = accountBalances.get(fromAccId) ?? 0;
            accountBalances.set(fromAccId, curFrom - amt);
          }
          if (toAccId) {
            const curTo = accountBalances.get(toAccId) ?? 0;
            accountBalances.set(toAccId, curTo + amt);
          }
        }
      }
    });

    const accountsWithBalances = (accounts ?? []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      purpose: acc.purpose,
      is_default: acc.is_default,
      opening_balance_paise: Number(acc.opening_balance_paise),
      target_goal_paise: acc.target_goal_paise != null ? Number(acc.target_goal_paise) : null,
      current_balance_paise: accountBalances.get(acc.id) ?? Number(acc.opening_balance_paise),
    }));

    const categoryMap = new Map((categories ?? []).map((category) => [category.id, category]));
    const transactions = (txList ?? []).map((transaction) => {
      const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null;
      const parsedMeta = parseTxMeta(transaction.note);

      let effectiveType: 'income' | 'expense' | 'transfer' = parsedMeta.type || transaction.type;
      let fromAccId = parsedMeta.from || transaction.account_id;
      let toAccId = parsedMeta.to || transaction.transfer_to_account_id;
      const merchantOrNote = `${transaction.merchant || ''} ${transaction.note || ''}`.toLowerCase();

      if (!fromAccId || !accountMap.has(fromAccId)) {
        fromAccId = resolveAccountForTx(fromAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'from');
      }
      if (effectiveType === 'transfer' && (!toAccId || !accountMap.has(toAccId))) {
        toAccId = resolveAccountForTx(toAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'to');
      }

      if (effectiveType !== 'transfer') {
        if (merchantOrNote.includes('deposit to cash vault') || merchantOrNote.includes('deposit into cash vault')) {
          effectiveType = 'transfer';
          fromAccId = cashAcc?.id ?? 'default-cash';
          toAccId = cashVaultAcc?.id ?? 'default-cash-vault';
        } else if (merchantOrNote.includes('deposit to online vault') || merchantOrNote.includes('deposit into online vault') || merchantOrNote.includes('deposit to savings vault')) {
          effectiveType = 'transfer';
          fromAccId = bankAcc?.id ?? 'default-bank';
          toAccId = onlineVaultAcc?.id ?? 'default-online-vault';
        }
      }

      const fromAccount = fromAccId ? accountMap.get(fromAccId) : null;
      const toAccount = toAccId ? accountMap.get(toAccId) : null;

      return {
        id: transaction.id,
        type: effectiveType,
        amount_paise: Number(transaction.amount_paise),
        account_id: fromAccId,
        account_name: fromAccount?.name ?? parsedMeta.fromName ?? 'Bank / UPI',
        transfer_to_account_id: toAccId ?? null,
        transfer_to_account_name: toAccount?.name ?? parsedMeta.toName ?? null,
        merchant: transaction.merchant,
        note: parsedMeta.cleanNote || null,
        category_name: category?.name ?? (effectiveType === 'transfer' ? 'Transfer' : 'General'),
        category_color: category?.color ?? (effectiveType === 'transfer' ? '#3B82F6' : '#64748B'),
        source: transaction.source,
        occurred_at: transaction.occurred_at,
      };
    });

    const isLinked = Boolean(activeSettings?.phone_verified);

    return NextResponse.json({
      authenticated: true,
      linked: isLinked,
      phone: activeSettings?.phone_number ?? null,
      email: user.email?.endsWith('@phone.trackexpenser.app')
        ? user.email.replace('@phone.trackexpenser.app', '')
        : (user.email ?? null),
      monthlyBudgetPaise: activeSettings?.monthly_budget_paise ?? 2500000,
      startingBalancePaise: activeSettings?.starting_balance_paise ?? 0,
      savingsUpiId: activeSettings?.savings_upi_id ?? null,
      currency: activeSettings?.currency ?? 'INR',
      timezone: activeSettings?.timezone ?? 'Asia/Kolkata',
      accounts: accountsWithBalances,
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
      try {
        const { error } = await admin
          .from('user_settings')
          .upsert(
            { user_id: user.id, starting_balance_paise: mutation.startingBalancePaise },
            { onConflict: 'user_id' }
          );

        if (error && error.code !== '42703' && !error.message?.includes('starting_balance_paise')) {
          console.error('[Dashboard API] Failed to update starting balance:', error);
          return NextResponse.json({ error: 'Could not save the starting balance.' }, { status: 500 });
        }
      } catch (err) {
        console.warn('[Dashboard API] Error updating starting balance in DB:', err);
      }

      return NextResponse.json({
        success: true,
        startingBalancePaise: mutation.startingBalancePaise,
      });
    }

    const isUuid = (id?: string | null): boolean =>
      typeof id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    if (mutation.action === 'reconcile_account') {
      if (!isUuid(mutation.account_id)) {
        return NextResponse.json({ error: 'Invalid account ID.' }, { status: 400 });
      }

      const { data: userAccounts, error: accountsError } = await admin
        .from('accounts')
        .select('id, name, type, purpose, is_default, opening_balance_paise')
        .eq('user_id', user.id);
      if (accountsError) {
        console.error('[Dashboard API] Failed to load accounts for reconciliation:', accountsError);
        return NextResponse.json({ error: 'Could not reconcile this account.' }, { status: 500 });
      }
      const reconciliationAccounts = userAccounts ?? [];
      const targetAccount = reconciliationAccounts.find((account) => account.id === mutation.account_id);
      if (!targetAccount) {
        return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
      }

      const openingBalance = Number(targetAccount.opening_balance_paise);
      let currentBalance = openingBalance;
      const bankAcc = reconciliationAccounts.find((account) => account.is_default || (account.purpose === 'spending' && account.type === 'bank'));
      const cashAcc = reconciliationAccounts.find((account) => account.purpose === 'spending' && account.type === 'cash');
      const onlineVaultAcc = reconciliationAccounts.find((account) => account.purpose === 'savings' && (account.type === 'bank' || account.name.toLowerCase().includes('online')));
      const cashVaultAcc = reconciliationAccounts.find((account) => account.purpose === 'savings' && (account.type === 'cash' || account.name.toLowerCase().includes('cash')));

      let allTx: any[] = [];
      const txRes = await admin
        .from('transactions')
        .select('type, amount_paise, account_id, transfer_to_account_id, merchant, note')
        .eq('user_id', user.id);

      if (txRes.error) {
        const fbRes = await admin
          .from('transactions')
          .select('type, amount_paise, merchant, note')
          .eq('user_id', user.id);
        if (fbRes.error) {
          console.error('[Dashboard API] Failed to load transactions for reconciliation:', fbRes.error);
          return NextResponse.json({ error: 'Could not reconcile this account.' }, { status: 500 });
        }
        allTx = fbRes.data ?? [];
      } else {
        allTx = txRes.data ?? [];
      }

      allTx.forEach((tx) => {
        const amt = Number(tx.amount_paise);
        const parsedMeta = parseTxMeta(tx.note);
        let effectiveType: 'income' | 'expense' | 'transfer' = parsedMeta.type || tx.type;
        let fromAccId = parsedMeta.from || tx.account_id;
        let toAccId = parsedMeta.to || tx.transfer_to_account_id;
        const merchantOrNote = `${tx.merchant || ''} ${tx.note || ''}`.toLowerCase();

        if (effectiveType !== 'transfer') {
          if (merchantOrNote.includes('deposit to cash vault') || merchantOrNote.includes('deposit into cash vault')) {
            effectiveType = 'transfer';
            fromAccId = 'default-cash';
            toAccId = 'default-cash-vault';
          } else if (merchantOrNote.includes('withdrawal from cash vault') || merchantOrNote.includes('withdraw from cash vault')) {
            effectiveType = 'transfer';
            fromAccId = 'default-cash-vault';
            toAccId = 'default-cash';
          } else if (merchantOrNote.includes('deposit to online vault') || merchantOrNote.includes('deposit into online vault') || merchantOrNote.includes('deposit to savings vault')) {
            effectiveType = 'transfer';
            fromAccId = 'default-bank';
            toAccId = 'default-online-vault';
          } else if (merchantOrNote.includes('withdrawal from online vault') || merchantOrNote.includes('withdraw from online vault') || merchantOrNote.includes('withdrawal from savings vault')) {
            effectiveType = 'transfer';
            fromAccId = 'default-online-vault';
            toAccId = 'default-bank';
          }
        }

        if (!fromAccId || !reconciliationAccounts.some((account) => account.id === fromAccId)) {
          fromAccId = resolveAccountForTx(fromAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'from');
        }
        if (effectiveType === 'transfer' && (!toAccId || !reconciliationAccounts.some((account) => account.id === toAccId))) {
          toAccId = resolveAccountForTx(toAccId, merchantOrNote, bankAcc, cashAcc, onlineVaultAcc, cashVaultAcc, 'to');
        }

        if (effectiveType === 'income' && fromAccId === targetAccount.id) {
          currentBalance += amt;
        } else if (effectiveType === 'expense' && fromAccId === targetAccount.id) {
          currentBalance -= amt;
        } else if (effectiveType === 'transfer') {
          if (fromAccId && toAccId && fromAccId === toAccId) {
            if (fromAccId === targetAccount.id) currentBalance += amt;
          } else {
            if (fromAccId === targetAccount.id) currentBalance -= amt;
            if (toAccId === targetAccount.id) currentBalance += amt;
          }
        }
      });

      const difference = mutation.actual_balance_paise - currentBalance;
      const openingBalancePaise = openingBalance + difference;
      if (openingBalancePaise < -MAX_PAISE || openingBalancePaise > MAX_PAISE) {
        return NextResponse.json({ error: 'The reconciled balance is outside the supported range.' }, { status: 400 });
      }

      const { data: updatedAccount, error: updateError } = await admin
        .from('accounts')
        .update({ opening_balance_paise: openingBalancePaise })
        .eq('id', targetAccount.id)
        .eq('user_id', user.id)
        .select('id, opening_balance_paise')
        .single();
      if (updateError || !updatedAccount) {
        console.error('[Dashboard API] Failed to reconcile account balance:', updateError);
        return NextResponse.json({ error: 'Could not reconcile this account.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        adjustedPaise: difference,
        newBalancePaise: mutation.actual_balance_paise,
        openingBalancePaise: Number(updatedAccount.opening_balance_paise),
      });
    }

    if (mutation.action === 'update_savings_upi') {
      const cleanUpi = mutation.savings_upi_id.trim() || null;
      try {
        await admin
          .from('user_settings')
          .upsert(
            { user_id: user.id, savings_upi_id: cleanUpi },
            { onConflict: 'user_id' }
          );
      } catch (err) {
        console.warn('[Dashboard API] savings_upi_id not in DB schema yet:', err);
      }

      return NextResponse.json({
        success: true,
        savingsUpiId: cleanUpi,
      });
    }

    if (mutation.action === 'update_account_goal') {
      if (!isUuid(mutation.account_id)) {
        return NextResponse.json({
          success: true,
          account: { id: mutation.account_id, target_goal_paise: mutation.target_goal_paise },
        });
      }

      const { data: updatedAcc, error } = await admin
        .from('accounts')
        .update({ target_goal_paise: mutation.target_goal_paise })
        .eq('id', mutation.account_id)
        .eq('user_id', user.id)
        .select('id, name, target_goal_paise')
        .single();

      if (error) {
        console.error('[Dashboard API] Failed to update account goal:', error);
        return NextResponse.json({ error: 'Could not update savings goal.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        account: updatedAcc,
      });
    }

    if (mutation.action === 'create_account') {
      const { data: newAccount, error: accError } = await admin
        .from('accounts')
        .insert({
          user_id: user.id,
          name: mutation.name,
          type: mutation.type,
          purpose: mutation.purpose,
          opening_balance_paise: mutation.opening_balance_paise,
          target_goal_paise: mutation.target_goal_paise ?? null,
          is_default: false,
        })
        .select('id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default')
        .single();

      if (accError) {
        console.error('[Dashboard API] Failed to create account:', accError);
        return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, account: newAccount });
    }

    if (mutation.action === 'update_account') {
      const updates: {
        name?: string;
        type?: 'bank' | 'cash' | 'wallet';
        target_goal_paise?: number | null;
      } = {};
      if (mutation.name !== undefined) updates.name = mutation.name;
      if (mutation.type !== undefined) updates.type = mutation.type;
      if (mutation.target_goal_paise !== undefined) updates.target_goal_paise = mutation.target_goal_paise;

      const { data: updatedAcc, error: updateError } = await (admin
        .from('accounts') as any)
        .update(updates)
        .eq('id', mutation.account_id)
        .eq('user_id', user.id)
        .select('id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default')
        .single();

      if (updateError) {
        console.error('[Dashboard API] Failed to update account:', updateError);
        return NextResponse.json({ error: 'Could not update account.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, account: updatedAcc });
    }

    if (mutation.action === 'delete_account') {
      const { data: targetAccount, error: fetchErr } = await admin
        .from('accounts')
        .select('id, name, type, purpose, is_default')
        .eq('id', mutation.account_id)
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !targetAccount) {
        return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
      }

      if (targetAccount.is_default) {
        return NextResponse.json({ error: 'Cannot delete the default spending account.' }, { status: 400 });
      }

      if (mutation.transfer_to_account_id) {
        const allTxRes = await admin
          .from('transactions')
          .select('type, amount_paise, account_id, transfer_to_account_id')
          .eq('user_id', user.id);

        let balance = 0;
        (allTxRes.data || []).forEach((tx) => {
          const amt = Number(tx.amount_paise);
          if (tx.type === 'income' && tx.account_id === targetAccount.id) balance += amt;
          else if (tx.type === 'expense' && tx.account_id === targetAccount.id) balance -= amt;
          else if (tx.type === 'transfer') {
            if (tx.account_id === targetAccount.id && tx.transfer_to_account_id === targetAccount.id) {
              balance += amt;
            } else {
              if (tx.account_id === targetAccount.id) balance -= amt;
              if (tx.transfer_to_account_id === targetAccount.id) balance += amt;
            }
          }
        });

        if (balance > 0) {
          await safeInsertTransaction(admin, {
            user_id: user.id,
            type: 'transfer',
            amount_paise: balance,
            account_id: targetAccount.id,
            transfer_to_account_id: mutation.transfer_to_account_id,
            merchant: `Vault Closed: Transfer to Spending`,
            note: `Remaining balance transferred upon deleting ${targetAccount.name}`,
            occurred_at: new Date().toISOString(),
          });
        }
      }

      const { error: delError } = await admin
        .from('accounts')
        .delete()
        .eq('id', targetAccount.id)
        .eq('user_id', user.id);

      if (delError) {
        console.error('[Dashboard API] Failed to delete account:', delError);
        return NextResponse.json({ error: 'Could not delete account.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, deletedAccountId: targetAccount.id });
    }

    // Default: add_transaction
    const [accountsResult, categoriesResult] = await Promise.all([
      admin
        .from('accounts')
        .select('id, name, type, purpose, is_default')
        .eq('user_id', user.id),
      admin
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id),
    ]);
    let userAccounts = accountsResult.data;

    // If user has no accounts yet in DB, ensure core accounts exist
    if ((!userAccounts || userAccounts.length === 0) && typeof admin.from('accounts')?.insert === 'function') {
      try {
        const { data: seeded } = await admin
          .from('accounts')
          .insert([
            { user_id: user.id, name: 'Bank / UPI', type: 'bank', purpose: 'spending', opening_balance_paise: 0, is_default: true },
            { user_id: user.id, name: 'Cash', type: 'cash', purpose: 'spending', opening_balance_paise: 0, is_default: false },
            { user_id: user.id, name: 'Online Vault', type: 'bank', purpose: 'savings', opening_balance_paise: 0, is_default: false },
            { user_id: user.id, name: 'Cash Vault', type: 'cash', purpose: 'savings', opening_balance_paise: 0, is_default: false },
          ])
          .select('id, name, type, purpose, is_default');
        if (seeded && seeded.length > 0) {
          userAccounts = seeded;
        }
      } catch (err) {
        console.warn('[Dashboard API] Auto-seeding in add_transaction warning:', err);
      }
    }

    const availableAccounts = (userAccounts && userAccounts.length > 0) ? userAccounts : [
      { id: 'default-bank', name: 'Bank / UPI', type: 'bank', purpose: 'spending', is_default: true },
      { id: 'default-cash', name: 'Cash', type: 'cash', purpose: 'spending', is_default: false },
      { id: 'default-online-vault', name: 'Online Vault', type: 'bank', purpose: 'savings', is_default: false },
      { id: 'default-cash-vault', name: 'Cash Vault', type: 'cash', purpose: 'savings', is_default: false },
    ];

    const resolveAccountId = (accId?: string | null): string | null => {
      if (!accId || availableAccounts.length === 0) return null;
      if (isUuid(accId)) {
        const found = availableAccounts.find((a) => a.id === accId);
        if (found) return found.id;
      }
      const lower = accId.toLowerCase();
      if (lower.includes('cash-vault') || (lower.includes('vault') && lower.includes('cash')) || lower === 'cash vault') {
        const acc = availableAccounts.find((a) => a.purpose === 'savings' && (a.type === 'cash' || a.name.toLowerCase().includes('cash')));
        if (acc) return acc.id;
      }
      if (lower.includes('online-vault') || (lower.includes('vault') && lower.includes('online')) || lower === 'online vault' || lower.includes('savings')) {
        const acc = availableAccounts.find((a) => a.purpose === 'savings' && (a.type === 'bank' || a.name.toLowerCase().includes('online') || a.name.toLowerCase().includes('savings')));
        if (acc) return acc.id;
      }
      if (lower.includes('cash')) {
        const acc = availableAccounts.find((a) => a.purpose === 'spending' && a.type === 'cash');
        if (acc) return acc.id;
      }
      if (lower.includes('bank') || lower.includes('upi') || lower.includes('default')) {
        const acc = availableAccounts.find((a) => a.is_default || (a.purpose === 'spending' && a.type === 'bank'));
        if (acc) return acc.id;
      }
      const named = availableAccounts.find((a) => a.name.toLowerCase() === lower);
      if (named) return named.id;

      return availableAccounts.find((a) => a.is_default)?.id ?? availableAccounts[0]?.id ?? null;
    };

    let targetAccountId = resolveAccountId(mutation.account_id);
    let transferToAccountId = mutation.type === 'transfer' ? resolveAccountId(mutation.transfer_to_account_id) : null;

    let transactionType: 'income' | 'expense' | 'transfer' = mutation.type;
    let finalTransferTo = transferToAccountId;

    const sourceAccount = availableAccounts.find((a) => a.id === targetAccountId);
    const destAccount = availableAccounts.find((a) => a.id === transferToAccountId);
    const sourceName = mutation.source_account_name || sourceAccount?.name || 'Bank / UPI';
    const destName = mutation.transfer_to_account_name || destAccount?.name || null;

    // Flexible Transfer: If transferring from same account to same account,
    // convert into a direct deposit / top-up (type: 'income') so database check constraint passes
    // and account balance increases cleanly!
    const isSameAccount = transactionType === 'transfer' && targetAccountId && targetAccountId === transferToAccountId;
    if (isSameAccount) {
      transactionType = 'income';
      finalTransferTo = null;
    }

    const metaTag = formatTxMeta({
      type: isSameAccount ? 'income' : transactionType,
      from: targetAccountId,
      to: finalTransferTo,
      fromName: sourceName,
      toName: destName,
    });

    let merchant = mutation.merchant?.trim();
    if (!merchant) {
      if (isSameAccount) {
        merchant = `${sourceName} Top-up`;
      } else if (transactionType === 'transfer') {
        merchant = `Transfer: ${sourceName} → ${destName}`;
      } else if (transactionType === 'income') {
        merchant = `${sourceName} Deposit`;
      }
    }

    const noteContent = mutation.note?.trim().slice(0, Math.max(0, 280 - metaTag.length - 1));
    const fullNote = noteContent
      ? `${noteContent} ${metaTag}`
      : metaTag;

    let categoryId: string | null = null;
    if (transactionType !== 'transfer' && mutation.category_name) {
      const matchedCategory = categoriesResult.data?.find(
        (category) => category.name.toLowerCase() === mutation.category_name!.toLowerCase()
      );
      categoryId = matchedCategory?.id ?? null;
    }

    let occurredAtIso = new Date().toISOString();
    if (mutation.occurred_at) {
      const parsedDate = new Date(mutation.occurred_at);
      if (!Number.isNaN(parsedDate.getTime())) {
        occurredAtIso = parsedDate.toISOString();
      }
    }

    const txPayload: any = {
      user_id: user.id,
      type: transactionType,
      amount_paise: mutation.amount_paise,
      account_id: targetAccountId,
      transfer_to_account_id: finalTransferTo,
      category_id: categoryId,
      merchant,
      note: fullNote,
      source: 'web',
      occurred_at: occurredAtIso,
    };

    const { data: newTransaction, error: transactionError } = await safeInsertTransaction(admin, txPayload);

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
