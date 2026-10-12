-- Enable UUID generation extension
create extension if not exists "pgcrypto";

-- Function to automatically bump updated_at timestamp
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
create table public.categories (
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

create index idx_categories_user_id on public.categories(user_id);

create trigger tr_categories_updated_at
    before update on public.categories
    for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "Users can view their own categories"
    on public.categories for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own categories"
    on public.categories for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own categories"
    on public.categories for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own categories"
    on public.categories for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- ============================================================================
-- 2. TRANSACTIONS TABLE (Single Source of Truth)
-- ============================================================================
create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('income', 'expense')),
    amount_paise bigint not null check (amount_paise between 1 and 10000000000),
    category_id uuid,
    note text check (note is null or char_length(note) <= 280),
    occurred_at timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint fk_transactions_category_composite
        foreign key (user_id, category_id)
        references public.categories (user_id, id)
        on delete set null (category_id)
);

create index idx_transactions_user_occurred_cursor on public.transactions(user_id, occurred_at desc, id desc);
create index idx_transactions_category on public.transactions(user_id, category_id);

create trigger tr_transactions_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "Users can view their own transactions"
    on public.transactions for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own transactions"
    on public.transactions for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own transactions"
    on public.transactions for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own transactions"
    on public.transactions for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. BUDGETS TABLE
-- ============================================================================
create table public.budgets (
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

create index idx_budgets_user_id on public.budgets(user_id);

create trigger tr_budgets_updated_at
    before update on public.budgets
    for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

create policy "Users can view their own budgets"
    on public.budgets for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own budgets"
    on public.budgets for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own budgets"
    on public.budgets for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own budgets"
    on public.budgets for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. SECURITY INVOKER STORED FUNCTIONS (RLS Preserved)
-- ============================================================================

-- Function 1: Net Balance
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

-- Function 2: Monthly Summary
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

-- Function 3: Category Spend Breakdown
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
