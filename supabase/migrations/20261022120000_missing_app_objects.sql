-- Objects the app already reads or writes that no migration created, so a
-- fresh database (staging, CI, a new environment) is missing them. Every
-- statement is idempotent; on a database that already has these objects
-- (created by hand in the dashboard) this is a no-op.

-- ---------------------------------------------------------------------------
-- market_data: one row of monthly market stats per town. Shared reference
-- data (not agent-owned), read by the property detail page and the client
-- portal. Written only by the service role.
-- ---------------------------------------------------------------------------
create table if not exists public.market_data (
  town                 text primary key,
  avg_sale_price       numeric(14, 2),
  days_on_market       integer,
  price_change_pct     numeric(6, 2),
  inventory_change_pct numeric(6, 2),
  month_year           text,
  updated_at           timestamptz not null default now()
);

alter table public.market_data enable row level security;

drop policy if exists market_data_read on public.market_data;
create policy market_data_read on public.market_data
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- clients.portal_token: per-client secret for the read-only client portal
-- (/portal/<token>) and portal engagement logging. Nothing issues tokens yet,
-- so the portal stays unreachable until a token is set deliberately.
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists portal_token text;

create unique index if not exists clients_portal_token_key
  on public.clients (portal_token)
  where portal_token is not null;

-- ---------------------------------------------------------------------------
-- `files` bucket: listing photos uploaded from /listings/new. Public on
-- purpose (photos go into marketing copy); agents may only write under their
-- own folder (<user id>/...).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do nothing;

drop policy if exists files_owner_insert on storage.objects;
create policy files_owner_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists files_owner_update on storage.objects;
create policy files_owner_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists files_owner_delete on storage.objects;
create policy files_owner_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
