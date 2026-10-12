-- ============================================================================
-- Migration: 20261010000001_whatsapp_integration.sql
-- Description: Adds user_settings, phone_verifications, transaction source
--              metadata, whatsapp_message_id unique constraint, and timezone-aware
--              Safe-to-Spend daily allowance calculation.
-- ============================================================================

-- 1. USER SETTINGS TABLE
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

create trigger tr_user_settings_updated_at
    before update on public.user_settings
    for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
    on public.user_settings for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own settings"
    on public.user_settings for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own settings"
    on public.user_settings for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own settings"
    on public.user_settings for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- 2. PHONE VERIFICATIONS TABLE (For secure OTP linking from web)
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

create policy "Users can view their own verification requests"
    on public.phone_verifications for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own verification requests"
    on public.phone_verifications for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own verification requests"
    on public.phone_verifications for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


-- 3. ENHANCE TRANSACTIONS TABLE
alter table public.transactions
    add column if not exists source text not null default 'web' check (source in ('web', 'whatsapp_text', 'whatsapp_image')),
    add column if not exists merchant text check (merchant is null or char_length(merchant) <= 100),
    add column if not exists whatsapp_message_id text,
    add column if not exists raw_input text check (raw_input is null or char_length(raw_input) <= 1000);

-- Unique index for Webhook Idempotency (Prevents duplicate charges from retried Meta webhooks)
create unique index if not exists idx_transactions_whatsapp_msg_id
    on public.transactions (whatsapp_message_id)
    where whatsapp_message_id is not null;


-- 4. UPDATE USER SIGNUP TRIGGER (Create user_settings on signup)
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


-- 5. TIMEZONE-AWARE SAFE-TO-SPEND CALCULATION FUNCTION
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
