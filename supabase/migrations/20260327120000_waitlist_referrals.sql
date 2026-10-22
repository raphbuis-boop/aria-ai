-- Waitlist referral columns + public count RPC for landing page (anon can execute RPC only).

-- The base table used to live outside migrations (supabase/waitlist.sql), so a
-- fresh database failed here. Created idempotently; a no-op where it exists.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Service role bypasses RLS; there are no public policies (server-side inserts
-- only; anon reads the aggregate count through waitlist_public_stats()).
alter table public.waitlist enable row level security;

alter table public.waitlist add column if not exists referral_code text;
alter table public.waitlist add column if not exists referral_count int not null default 0;
alter table public.waitlist add column if not exists referred_by text;

create unique index if not exists waitlist_referral_code_key
  on public.waitlist (referral_code)
  where referral_code is not null;

comment on column public.waitlist.referral_code is '6-char unique code for share links';
comment on column public.waitlist.referral_count is 'Number of signups attributed to this referrer';
comment on column public.waitlist.referred_by is 'referral_code of the agent who referred this signup';

-- Safe public read: only aggregate count, no row data.
create or replace function public.waitlist_public_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'count', (select count(*)::int from public.waitlist)
  );
$$;

revoke all on function public.waitlist_public_stats() from public;
grant execute on function public.waitlist_public_stats() to anon;
grant execute on function public.waitlist_public_stats() to authenticated;

-- Atomic increment (called from API with service role only).
create or replace function public.increment_waitlist_referral_by_code(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.waitlist
  set referral_count = referral_count + 1
  where referral_code = lower(trim(p_code));
$$;

revoke all on function public.increment_waitlist_referral_by_code(text) from public;
grant execute on function public.increment_waitlist_referral_by_code(text) to service_role;
