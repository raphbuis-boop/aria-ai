-- Billing state + runtime detection of the (out-of-repo) signup allowlist.

-- ── Billing ──────────────────────────────────────────────────────────────────
-- Separate from agent_profiles on purpose: agents can update their own
-- profile row from the browser, so billing fields there could be self-granted.
-- This table is readable by its owner and writable only by the service role
-- (Stripe webhook / server routes).
create table if not exists public.agent_billing (
  agent_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text,                         -- Stripe subscription status (active, trialing, past_due, canceled, …)
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  exempt boolean not null default false, -- comped accounts (founder, family) — set by hand in SQL
  updated_at timestamptz not null default now()
);

alter table public.agent_billing enable row level security;
drop policy if exists "agent_billing_select_own" on public.agent_billing;
create policy "agent_billing_select_own" on public.agent_billing
  for select to authenticated using (agent_id = auth.uid());
revoke insert, update, delete on public.agent_billing from anon, authenticated;
grant select on public.agent_billing to authenticated;

-- ── Signup allowlist detection ───────────────────────────────────────────────
-- The allowlist (public.allowed_signups + a trigger on auth.users) was added
-- by hand, not by a migration, so the app can't assume it exists. This
-- reports what is actually there. Service role only.
create or replace function public.signup_gate_status()
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  has_trigger boolean;
  row_count integer;
begin
  select exists (
    select 1
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    where tg.tgrelid = 'auth.users'::regclass
      and not tg.tgisinternal
      and tg.tgenabled <> 'D'
      and pg_get_functiondef(p.oid) ilike '%allowed_signups%'
  ) into has_trigger;

  if to_regclass('public.allowed_signups') is null then
    row_count := null;
  else
    execute 'select count(*) from public.allowed_signups' into row_count;
  end if;

  return json_build_object('trigger', has_trigger, 'table', row_count is not null, 'rows', row_count);
end;
$$;

-- True when the email is on the allowlist (case-insensitive). False when the
-- table or its email column doesn't exist.
create or replace function public.is_signup_allowlisted(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  found boolean;
begin
  if to_regclass('public.allowed_signups') is null then
    return false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'allowed_signups' and column_name = 'email'
  ) then
    return false;
  end if;
  execute 'select exists (select 1 from public.allowed_signups where lower(email) = lower($1))'
    into found using p_email;
  return coalesce(found, false);
end;
$$;

revoke all on function public.signup_gate_status() from public, anon, authenticated;
revoke all on function public.is_signup_allowlisted(text) from public, anon, authenticated;
grant execute on function public.signup_gate_status() to service_role;
grant execute on function public.is_signup_allowlisted(text) to service_role;
