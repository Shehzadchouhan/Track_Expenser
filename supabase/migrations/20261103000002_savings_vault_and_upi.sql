-- ============================================================================
-- TRACK EXPENSER: SAVINGS VAULT & UPI PAY INTEGRATION MIGRATION
-- ============================================================================

-- 1. EXTEND ACCOUNTS TABLE WITH TARGET SAVINGS GOAL
alter table public.accounts
    add column if not exists target_goal_paise bigint
        check (target_goal_paise is null or (target_goal_paise >= 0 and target_goal_paise <= 10000000000));

-- 2. EXTEND USER_SETTINGS TABLE WITH SAVINGS UPI ID
alter table public.user_settings
    add column if not exists savings_upi_id text
        check (savings_upi_id is null or char_length(savings_upi_id) between 3 and 100);

-- 3. UPDATE USER CREATION TRIGGER TO SEED DEFAULT SAVINGS VAULT
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

    -- 2. Insert default accounts:
    --    - Bank / UPI (Spending, Default)
    --    - Cash (Spending)
    --    - Savings Vault (Savings, Ring-fenced from safe-to-spend)
    insert into public.accounts (user_id, name, type, purpose, opening_balance_paise, target_goal_paise, is_default)
    values
        (new.id, 'Bank / UPI', 'bank', 'spending', 5000000, null, true),
        (new.id, 'Cash', 'cash', 'spending', 0, null, false),
        (new.id, 'Savings Vault', 'bank', 'savings', 0, 5000000, false)
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

-- 4. UPDATE get_account_balances TO EXPOSE target_goal_paise
drop function if exists public.get_account_balances(uuid);

create or replace function public.get_account_balances(p_user_id uuid default null)
returns table (
    account_id uuid,
    account_name text,
    account_type text,
    account_purpose text,
    is_default boolean,
    opening_balance_paise bigint,
    target_goal_paise bigint,
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
        a.target_goal_paise,
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
    group by a.id, a.name, a.type, a.purpose, a.is_default, a.opening_balance_paise, a.target_goal_paise
    order by a.is_default desc, a.created_at asc;
end;
$$;
