-- Automatically seed default categories when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Drop trigger if it already exists, then create it
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
