create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

-- Service role bypasses RLS; no public policies needed for server-side inserts via API.
