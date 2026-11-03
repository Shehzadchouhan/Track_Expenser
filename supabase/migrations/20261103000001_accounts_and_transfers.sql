-- ============================================================================
-- TRACK EXPENSER: ACCOUNTS, TRANSFERS, AND RECONCILIATION MIGRATION
-- ============================================================================

-- 1. ACCOUNTS TABLE
create table if not exists public.accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 50),
    type text not null default 'bank' check (type in ('bank', 'cash', 'wallet')),
    purpose text not null default 'spending' check (purpose in ('spending', 'savings')),
    opening_balance_paise bigint not null default 0 check (opening_balance_paise between -10000000000 and 10000000000),
    is_default boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint accounts_user_id_id_unique unique (user_id, id),
    constraint accounts_user_id_name_unique unique (user_id, name)
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);

drop trigger if exists tr_accounts_updated_at on public.accounts;
create trigger tr_accounts_updated_at
    before update on public.accounts
    for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

drop policy if exists "Users can view their own accounts" on public.accounts;
create policy "Users can view their own accounts"
    on public.accounts for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own accounts" on public.accounts;
create policy "Users can insert their own accounts"
    on public.accounts for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own accounts" on public.accounts;
create policy "Users can update their own accounts"
    on public.accounts for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own accounts" on public.accounts;
create policy "Users can delete their own accounts"
    on public.accounts for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- 2. TRANSACTIONS TABLE UPDATES (Add Transfers and Account Links)
alter table public.transactions
    drop constraint if exists transactions_type_check;

alter table public.transactions
    add constraint transactions_type_check check (type in ('income', 'expense', 'transfer'));

alter table public.transactions
    add column if not exists account_id uuid,
    add column if not exists transfer_to_account_id uuid;

alter table public.transactions
    drop constraint if exists fk_transactions_account,
    drop constraint if exists fk_transactions_transfer_to_account,
    drop constraint if exists chk_transactions_transfer_validity;

alter table public.transactions
    add constraint fk_transactions_account
        foreign key (account_id) references public.accounts(id) on delete set null,
    add constraint fk_transactions_transfer_to_account
        foreign key (transfer_to_account_id) references public.accounts(id) on delete set null,
    add constraint chk_transactions_transfer_validity
        check (
            (type = 'transfer' and transfer_to_account_id is not null and account_id is not null and account_id <> transfer_to_account_id)
            or (type in ('income', 'expense') and transfer_to_account_id is null)
        );

create index if not exists idx_transactions_account on public.transactions(user_id, account_id);
create index if not exists idx_transactions_transfer_to on public.transactions(user_id, transfer_to_account_id);

-- 3. UPDATE USER CREATION TRIGGER TO SEED DEFAULT ACCOUNTS
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

    -- 2. Insert default accounts (Bank/UPI and Cash)
    insert into public.accounts (user_id, name, type, purpose, opening_balance_paise, is_default)
    values
        (new.id, 'Bank / UPI', 'bank', 'spending', 5000000, true),
        (new.id, 'Cash', 'cash', 'spending', 0, false)
    on conflict (user_id, name) do nothing;

    -- 3. Insert default categories
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

-- 4. FUNCTION TO RETRIEVE ACCOUNTS WITH LIVE BALANCES
create or replace function public.get_account_balances(p_user_id uuid default null)
returns table (
    account_id uuid,
    account_name text,
    account_type text,
    account_purpose text,
    is_default boolean,
    opening_balance_paise bigint,
    current_balance_paise bigint,
    total_income_paise bigint,
    total_expense_paise bigint,
    transfers_in_paise bigint,
    transfers_out_paise bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid := coalesce(p_user_id, (select auth.uid()));
begin
    return query
    select
        a.id as account_id,
        a.name as account_name,
        a.type as account_type,
        a.purpose as account_purpose,
        a.is_default,
        a.opening_balance_paise,
        (
            a.opening_balance_paise
            + coalesce(sum(case when t.type = 'income' and t.account_id = a.id then t.amount_paise else 0 end), 0)
            - coalesce(sum(case when t.type = 'expense' and t.account_id = a.id then t.amount_paise else 0 end), 0)
            + coalesce(sum(case when t.type = 'transfer' and t.transfer_to_account_id = a.id then t.amount_paise else 0 end), 0)
            - coalesce(sum(case when t.type = 'transfer' and t.account_id = a.id then t.amount_paise else 0 end), 0)
        )::bigint as current_balance_paise,
        coalesce(sum(case when t.type = 'income' and t.account_id = a.id then t.amount_paise else 0 end), 0)::bigint as total_income_paise,
        coalesce(sum(case when t.type = 'expense' and t.account_id = a.id then t.amount_paise else 0 end), 0)::bigint as total_expense_paise,
        coalesce(sum(case when t.type = 'transfer' and t.transfer_to_account_id = a.id then t.amount_paise else 0 end), 0)::bigint as transfers_in_paise,
        coalesce(sum(case when t.type = 'transfer' and t.account_id = a.id then t.amount_paise else 0 end), 0)::bigint as transfers_out_paise
    from public.accounts a
    left join public.transactions t
        on (t.account_id = a.id or t.transfer_to_account_id = a.id)
       and t.user_id = a.user_id
    where a.user_id = v_uid
    group by a.id, a.name, a.type, a.purpose, a.is_default, a.opening_balance_paise
    order by a.is_default desc, a.created_at asc;
end;
$$;
