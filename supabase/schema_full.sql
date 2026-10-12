-- ============================================================================
-- TRACK EXPENSER: COMPLETE ALL-IN-ONE DATABASE SETUP
-- Safe to run on a brand-new Supabase project in the SQL Editor.
-- ============================================================================

-- 0. EXTENSIONS & UTILITY FUNCTIONS
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;


-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================
create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 40),
    color text not null check (color ~* '^#[0-9a-fA-F]{6}$'),
    kind text not null check (kind in ('income', 'expense')),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint categories_user_id_id_unique unique (user_id, id),
    constraint categories_user_name_kind_unique unique (user_id, name, kind)
);

create index if not exists idx_categories_user_id on public.categories(user_id);

drop trigger if exists tr_categories_updated_at on public.categories;
create trigger tr_categories_updated_at
    before update on public.categories
    for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

drop policy if exists "Users can view their own categories" on public.categories;
create policy "Users can view their own categories"
    on public.categories for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own categories" on public.categories;
create policy "Users can insert their own categories"
    on public.categories for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own categories" on public.categories;
create policy "Users can update their own categories"
    on public.categories for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own categories" on public.categories;
create policy "Users can delete their own categories"
    on public.categories for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- ============================================================================
-- 2. TRANSACTIONS TABLE (With WhatsApp & Web Metadata)
-- ============================================================================
create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('income', 'expense')),
    amount_paise bigint not null check (amount_paise between 1 and 10000000000),
    category_id uuid,
    note text check (note is null or char_length(note) <= 280),
    merchant text check (merchant is null or char_length(merchant) <= 100),
    source text not null default 'web' check (source in ('web', 'whatsapp_text', 'whatsapp_image')),
    whatsapp_message_id text,
    raw_input text check (raw_input is null or char_length(raw_input) <= 1000),
    occurred_at timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint fk_transactions_category_composite
        foreign key (user_id, category_id)
        references public.categories (user_id, id)
        on delete set null (category_id)
);

create index if not exists idx_transactions_user_occurred_cursor on public.transactions(user_id, occurred_at desc, id desc);
create index if not exists idx_transactions_category on public.transactions(user_id, category_id);

-- Unique index for Webhook Idempotency (Prevents duplicate charges from retried Meta webhooks)
create unique index if not exists idx_transactions_whatsapp_msg_id
    on public.transactions (whatsapp_message_id)
    where whatsapp_message_id is not null;

drop trigger if exists tr_transactions_updated_at on public.transactions;
create trigger tr_transactions_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
    on public.transactions for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions"
    on public.transactions for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions"
    on public.transactions for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
    on public.transactions for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- ============================================================================
-- 3. BUDGETS TABLE
-- ============================================================================
create table if not exists public.budgets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid not null,
    monthly_limit_paise bigint not null check (monthly_limit_paise between 1 and 10000000000),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint budgets_user_category_unique unique (user_id, category_id),
    constraint fk_budgets_category_composite
        foreign key (user_id, category_id)
        references public.categories (user_id, id)
        on delete cascade
);

create index if not exists idx_budgets_user_id on public.budgets(user_id);

drop trigger if exists tr_budgets_updated_at on public.budgets;
create trigger tr_budgets_updated_at
    before update on public.budgets
    for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

drop policy if exists "Users can view their own budgets" on public.budgets;
create policy "Users can view their own budgets"
    on public.budgets for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own budgets" on public.budgets;
create policy "Users can insert their own budgets"
    on public.budgets for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own budgets" on public.budgets;
create policy "Users can update their own budgets"
    on public.budgets for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own budgets" on public.budgets;
create policy "Users can delete their own budgets"
    on public.budgets for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- ============================================================================
-- 4. USER SETTINGS & PHONE LINKING TABLE
-- ============================================================================
create table if not exists public.user_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    phone_number text unique check (phone_number is null or phone_number ~ '^\+[1-9]\d{6,14}$'),
    phone_verified boolean not null default false,
    monthly_budget_paise bigint check (monthly_budget_paise is null or monthly_budget_paise between 1 and 10000000000),
    currency text not null default 'INR' check (char_length(currency) between 3 and 4),
    timezone text not null default 'Asia/Kolkata',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_user_settings_phone on public.user_settings(phone_number) where phone_number is not null;

drop trigger if exists tr_user_settings_updated_at on public.user_settings;
create trigger tr_user_settings_updated_at
    before update on public.user_settings
    for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "Users can view their own settings" on public.user_settings;
create policy "Users can view their own settings"
    on public.user_settings for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
    on public.user_settings for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
    on public.user_settings for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own settings" on public.user_settings;
create policy "Users can delete their own settings"
    on public.user_settings for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- ============================================================================
-- 5. PHONE VERIFICATIONS TABLE (For secure OTP linking from web)
-- ============================================================================
create table if not exists public.phone_verifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    phone_number text not null check (phone_number ~ '^\+[1-9]\d{6,14}$'),
    otp_code text not null check (char_length(otp_code) = 6),
    attempts int not null default 0 check (attempts between 0 and 5),
    expires_at timestamptz not null,
    verified_at timestamptz,
    created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_phone_verifications_lookup 
    on public.phone_verifications(user_id, phone_number, expires_at);

alter table public.phone_verifications enable row level security;

drop policy if exists "Users can view their own verification requests" on public.phone_verifications;
create policy "Users can view their own verification requests"
    on public.phone_verifications for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own verification requests" on public.phone_verifications;
create policy "Users can insert their own verification requests"
    on public.phone_verifications for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own verification requests" on public.phone_verifications;
create policy "Users can update their own verification requests"
    on public.phone_verifications for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


-- ============================================================================
-- 6. USER SIGNUP TRIGGER (Seeds default categories and user settings)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- 1. Insert default settings
    insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    -- 2. Insert default categories
    insert into public.categories (user_id, name, color, kind)
    values
        -- Income Categories
        (new.id, 'Salary', '#10B981', 'income'),
        (new.id, 'Freelance', '#06B6D4', 'income'),
        (new.id, 'Investment', '#14B8A6', 'income'),
        (new.id, 'Other Income', '#22C55E', 'income'),
        -- Expense Categories
        (new.id, 'Food & Dining', '#F59E0B', 'expense'),
        (new.id, 'Groceries', '#84CC16', 'expense'),
        (new.id, 'Transportation', '#3B82F6', 'expense'),
        (new.id, 'Housing & Utilities', '#8B5CF6', 'expense'),
        (new.id, 'Entertainment', '#EC4899', 'expense'),
        (new.id, 'Health & Medical', '#EF4444', 'expense'),
        (new.id, 'Shopping', '#F97316', 'expense'),
        (new.id, 'Other Expense', '#64748B', 'expense')
    on conflict (user_id, name, kind) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ============================================================================
-- 7. STORED REPORTING FUNCTIONS (Balance, Summary, Spend)
-- ============================================================================
create or replace function public.get_balance()
returns table (
    total_income_paise bigint,
    total_expense_paise bigint,
    net_balance_paise bigint
)
language sql
security invoker
set search_path = public
as $$
    select
        coalesce(sum(case when type = 'income' then amount_paise else 0 end), 0)::bigint as total_income_paise,
        coalesce(sum(case when type = 'expense' then amount_paise else 0 end), 0)::bigint as total_expense_paise,
        coalesce(sum(case when type = 'income' then amount_paise else -amount_paise end), 0)::bigint as net_balance_paise
    from public.transactions
    where user_id = (select auth.uid());
$$;

create or replace function public.get_monthly_summary(
    month_start timestamptz,
    month_end timestamptz
)
returns table (
    total_income_paise bigint,
    total_expense_paise bigint,
    net_balance_paise bigint,
    transaction_count bigint
)
language sql
security invoker
set search_path = public
as $$
    select
        coalesce(sum(case when type = 'income' then amount_paise else 0 end), 0)::bigint as total_income_paise,
        coalesce(sum(case when type = 'expense' then amount_paise else 0 end), 0)::bigint as total_expense_paise,
        coalesce(sum(case when type = 'income' then amount_paise else -amount_paise end), 0)::bigint as net_balance_paise,
        count(*)::bigint as transaction_count
    from public.transactions
    where user_id = (select auth.uid())
      and occurred_at >= month_start
      and occurred_at <= month_end;
$$;

create or replace function public.get_category_spend(
    month_start timestamptz,
    month_end timestamptz
)
returns table (
    category_id uuid,
    category_name text,
    category_color text,
    kind text,
    total_spend_paise bigint,
    transaction_count bigint
)
language sql
security invoker
set search_path = public
as $$
    select
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.kind as kind,
        coalesce(sum(t.amount_paise), 0)::bigint as total_spend_paise,
        count(t.id)::bigint as transaction_count
    from public.categories c
    left join public.transactions t
        on t.category_id = c.id
       and t.user_id = c.user_id
       and t.type = 'expense'
       and t.occurred_at >= month_start
       and t.occurred_at <= month_end
    where c.user_id = (select auth.uid())
    group by c.id, c.name, c.color, c.kind;
$$;


-- ============================================================================
-- 8. TIMEZONE-AWARE SAFE-TO-SPEND CALCULATION FUNCTION
-- ============================================================================
create or replace function public.get_daily_budget_pulse(
    p_user_id uuid default null,
    p_timezone text default 'Asia/Kolkata'
)
returns table (
    monthly_budget_paise bigint,
    month_spent_paise bigint,
    month_remaining_paise bigint,
    spent_today_paise bigint,
    daily_safe_allowance_paise bigint,
    remaining_today_paise bigint,
    days_remaining_in_month int,
    is_over_budget boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_target_user_id uuid;
    v_tz text;
    v_now_tz timestamp;
    v_today_start timestamptz;
    v_today_end timestamptz;
    v_month_start timestamptz;
    v_next_month_start timestamptz;
    v_days_in_month int;
    v_current_day int;
    v_days_left int;
    v_budget bigint;
    v_month_spent bigint;
    v_today_spent bigint;
    v_month_remaining bigint;
    v_daily_allowance bigint;
    v_remaining_today bigint;
begin
    -- Determine target user (authenticated caller or explicit argument for service-role)
    v_target_user_id := coalesce(p_user_id, (select auth.uid()));
    if v_target_user_id is null then
        raise exception 'User not specified and no authenticated session found';
    end if;

    -- Fallback timezone if not valid
    v_tz := coalesce(p_timezone, 'Asia/Kolkata');

    -- Compute timezone-aware temporal boundaries
    v_now_tz := timezone(v_tz, now());
    v_today_start := timezone(v_tz, date_trunc('day', v_now_tz));
    v_today_end := v_today_start + interval '1 day';
    v_month_start := timezone(v_tz, date_trunc('month', v_now_tz));
    v_next_month_start := timezone(v_tz, date_trunc('month', v_now_tz) + interval '1 month');

    -- Days calculation (counting today as remaining)
    v_days_in_month := extract(day from (date_trunc('month', v_now_tz) + interval '1 month - 1 day'))::int;
    v_current_day := extract(day from v_now_tz)::int;
    v_days_left := greatest(1, v_days_in_month - v_current_day + 1);

    -- Retrieve monthly budget from user settings
    select s.monthly_budget_paise into v_budget
    from public.user_settings s
    where s.user_id = v_target_user_id;

    -- Calculate total expenses in current month
    select coalesce(sum(t.amount_paise), 0)::bigint into v_month_spent
    from public.transactions t
    where t.user_id = v_target_user_id
      and t.type = 'expense'
      and t.occurred_at >= v_month_start
      and t.occurred_at < v_next_month_start;

    -- Calculate total expenses today
    select coalesce(sum(t.amount_paise), 0)::bigint into v_today_spent
    from public.transactions t
    where t.user_id = v_target_user_id
      and t.type = 'expense'
      and t.occurred_at >= v_today_start
      and t.occurred_at < v_today_end;

    -- Calculate safe-to-spend pacing
    if v_budget is not null and v_budget > 0 then
        v_month_remaining := greatest(0::bigint, v_budget - v_month_spent);
        v_daily_allowance := (v_month_remaining / v_days_left)::bigint;
    else
        v_month_remaining := 0::bigint;
        v_daily_allowance := 0::bigint;
    end if;

    -- Safe to spend remaining today (clamped to 0)
    v_remaining_today := greatest(0::bigint, v_daily_allowance - v_today_spent);

    return query select
        coalesce(v_budget, 0::bigint) as monthly_budget_paise,
        v_month_spent as month_spent_paise,
        v_month_remaining as month_remaining_paise,
        v_today_spent as spent_today_paise,
        v_daily_allowance as daily_safe_allowance_paise,
        v_remaining_today as remaining_today_paise,
        v_days_left as days_remaining_in_month,
        (v_budget is not null and v_month_spent > v_budget) as is_over_budget;
end;
$$;
