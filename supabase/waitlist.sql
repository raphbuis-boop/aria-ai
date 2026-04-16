create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now(),
  referral_code text unique,
  referral_count int not null default 0,
  referred_by text
);

alter table waitlist enable row level security;

-- Service role bypasses RLS; no public policies needed for server-side inserts via API.
-- See migrations for waitlist_public_stats() RPC (anon can count via RPC only).
