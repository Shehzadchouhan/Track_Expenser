-- Keep phone-verification secrets out of user-readable rows and enforce OTP
-- request/verification limits atomically across application instances.
alter table public.user_settings
    add column if not exists starting_balance_paise bigint not null default 5000000
        check (starting_balance_paise between 0 and 10000000000);

alter table public.phone_verifications
    alter column otp_code drop not null,
    add column if not exists otp_hash text,
    add column if not exists intent text not null default 'sign_in'
        check (intent in ('sign_in', 'link'));

alter table public.phone_verifications
    drop constraint if exists phone_verifications_otp_code_check;

alter table public.phone_verifications
    add constraint phone_verifications_otp_secret_check
    check (
        (otp_code is null and otp_hash is not null)
        or (otp_code is not null and otp_hash is null)
    );

drop policy if exists "Users can view their own verification requests"
    on public.phone_verifications;
drop policy if exists "Users can insert their own verification requests"
    on public.phone_verifications;
drop policy if exists "Users can update their own verification requests"
    on public.phone_verifications;

revoke all on public.phone_verifications from anon, authenticated;
grant all on public.phone_verifications to service_role;

drop policy if exists "Users can insert their own settings" on public.user_settings;
drop policy if exists "Users can update their own settings" on public.user_settings;
drop policy if exists "Users can delete their own settings" on public.user_settings;
revoke all on public.user_settings from anon, authenticated;
grant select on public.user_settings to authenticated;

create table if not exists public.phone_otp_rate_limits (
    phone_number text primary key check (phone_number ~ '^\+[1-9]\d{6,14}$'),
    window_started_at timestamptz not null,
    request_count integer not null check (request_count between 1 and 3),
    last_requested_at timestamptz not null
);

alter table public.phone_otp_rate_limits enable row level security;
revoke all on public.phone_otp_rate_limits from anon, authenticated;
grant all on public.phone_otp_rate_limits to service_role;

create or replace function public.reserve_phone_otp_request(p_phone_number text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz := now();
    v_limit public.phone_otp_rate_limits%rowtype;
    v_retry integer;
begin
    if p_phone_number !~ '^\+[1-9]\d{6,14}$' then
        raise exception 'Invalid phone number';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_phone_number, 0));

    select * into v_limit
    from public.phone_otp_rate_limits
    where phone_number = p_phone_number
    for update;

    if not found then
        insert into public.phone_otp_rate_limits
            (phone_number, window_started_at, request_count, last_requested_at)
        values (p_phone_number, v_now, 1, v_now);
        return query select true, 0;
        return;
    end if;

    if v_limit.window_started_at + interval '15 minutes' <= v_now then
        update public.phone_otp_rate_limits
        set window_started_at = v_now, request_count = 1, last_requested_at = v_now
        where phone_number = p_phone_number;
        return query select true, 0;
        return;
    end if;

    if v_limit.request_count >= 3 then
        v_retry := greatest(1, ceil(extract(epoch from
            (v_limit.window_started_at + interval '15 minutes' - v_now)))::integer);
        return query select false, v_retry;
        return;
    end if;

    if v_limit.last_requested_at + interval '60 seconds' > v_now then
        v_retry := greatest(1, ceil(extract(epoch from
            (v_limit.last_requested_at + interval '60 seconds' - v_now)))::integer);
        return query select false, v_retry;
        return;
    end if;

    update public.phone_otp_rate_limits
    set request_count = request_count + 1, last_requested_at = v_now
    where phone_number = p_phone_number;

    return query select true, 0;
end;
$$;

revoke all on function public.reserve_phone_otp_request(text) from public, anon, authenticated;
grant execute on function public.reserve_phone_otp_request(text) to service_role;

create or replace function public.consume_phone_otp(
    p_phone_number text,
    p_otp_hash text,
    p_authenticated_user_id uuid
)
returns table (
    verification_status text,
    verified_user_id uuid,
    remaining_attempts integer,
    verification_intent text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_record public.phone_verifications%rowtype;
    v_remaining integer;
begin
    select * into v_record
    from public.phone_verifications
    where phone_number = p_phone_number
      and verified_at is null
    order by created_at desc
    limit 1
    for update;

    if not found then
        return query select 'missing'::text, null::uuid, 0, null::text;
        return;
    end if;

    if v_record.intent = 'link'
       and v_record.user_id is distinct from p_authenticated_user_id then
        return query select 'forbidden'::text, null::uuid, 0, v_record.intent;
        return;
    end if;

    if v_record.expires_at <= now() then
        return query select 'expired'::text, null::uuid, 0, v_record.intent;
        return;
    end if;

    if v_record.attempts >= 5 then
        return query select 'locked'::text, null::uuid, 0, v_record.intent;
        return;
    end if;

    if v_record.otp_hash is null or v_record.otp_hash <> p_otp_hash then
        update public.phone_verifications
        set attempts = attempts + 1
        where id = v_record.id;
        v_remaining := greatest(0, 5 - v_record.attempts - 1);
        return query select 'incorrect'::text, null::uuid, v_remaining, v_record.intent;
        return;
    end if;

    update public.phone_verifications
    set verified_at = now()
    where id = v_record.id;

    return query select 'verified'::text, v_record.user_id, 0, v_record.intent;
end;
$$;

revoke all on function public.consume_phone_otp(text, text, uuid) from public, anon, authenticated;
grant execute on function public.consume_phone_otp(text, text, uuid) to service_role;
