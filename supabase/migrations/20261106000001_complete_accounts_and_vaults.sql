-- ============================================================================
-- TRACK EXPENSER: COMPLETE ACCOUNTS, 2 VAULTS & TRANSFERS MIGRATION
-- Run this once in your Supabase Dashboard -> SQL Editor (Click "New query", paste, and click "Run")
-- ============================================================================

-- 1. Create accounts table if not exists
create table if not exists public.accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 50),
    type text not null default 'bank' check (type in ('bank', 'cash', 'wallet')),
    purpose text not null default 'spending' check (purpose in ('spending', 'savings')),
    opening_balance_paise bigint not null default 0 check (opening_balance_paise between -10000000000 and 10000000000),
    target_goal_paise bigint check (target_goal_paise is null or (target_goal_paise >= 0 and target_goal_paise <= 10000000000)),
    is_default boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint accounts_user_id_name_unique unique (user_id, name)
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);

-- Ensure target_goal_paise column exists if table was created previously without it
alter table public.accounts
    add column if not exists target_goal_paise bigint
        check (target_goal_paise is null or (target_goal_paise >= 0 and target_goal_paise <= 10000000000));

-- Enable Row Level Security (RLS) on accounts
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

-- 2. Update user_settings table
alter table public.user_settings
    add column if not exists starting_balance_paise bigint default 0,
    add column if not exists savings_upi_id text
        check (savings_upi_id is null or char_length(savings_upi_id) between 3 and 100);

-- 3. Update transactions table constraints and columns
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
        foreign key (transfer_to_account_id) references public.accounts(id) on delete set null;

create index if not exists idx_transactions_account on public.transactions(user_id, account_id);
create index if not exists idx_transactions_transfer_to on public.transactions(user_id, transfer_to_account_id);

-- 4. Seed all 4 core accounts for every existing user in auth.users
insert into public.accounts (user_id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default)
select
    u.id,
    acc.name,
    acc.type,
    acc.purpose,
    acc.opening_balance_paise,
    acc.target_goal_paise,
    acc.is_default
from auth.users u
cross join (
    values
        ('Bank / UPI', 'bank', 'spending', 0::bigint, null::bigint, true),
        ('Cash', 'cash', 'spending', 0::bigint, null::bigint, false),
        ('Online Vault', 'bank', 'savings', 0::bigint, 5000000::bigint, false),
        ('Cash Vault', 'cash', 'savings', 0::bigint, 2000000::bigint, false)
) as acc(name, type, purpose, opening_balance_paise, target_goal_paise, is_default)
on conflict (user_id, name) do nothing;

-- 5. Update user creation trigger function to seed all 4 accounts for future sign-ups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.accounts (user_id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default)
    values
        (new.id, 'Bank / UPI', 'bank', 'spending', 0, null, true),
        (new.id, 'Cash', 'cash', 'spending', 0, null, false),
        (new.id, 'Online Vault', 'bank', 'savings', 0, 5000000, false),
        (new.id, 'Cash Vault', 'cash', 'savings', 0, 2000000, false)
    on conflict (user_id, name) do nothing;

    insert into public.categories (user_id, name, color, kind)
    values
        (new.id, 'Salary', '#10B981', 'income'),
        (new.id, 'Freelance', '#06B6D4', 'income'),
        (new.id, 'Investment', '#14B8A6', 'income'),
        (new.id, 'Other Income', '#22C55E', 'income'),
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
