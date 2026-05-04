-- Public IDX listing inquiries (inserted via service-role API only).
create table if not exists public.idx_listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  intent text not null default 'info' check (intent in ('info', 'showing')),
  visitor_name text not null,
  visitor_email text not null,
  visitor_phone text,
  message text,
  listing_id text not null,
  listing_address text,
  mls_number text
);

comment on table public.idx_listing_inquiries is 'IDX public leads; no direct client access — use API with service role.';

alter table public.idx_listing_inquiries enable row level security;
