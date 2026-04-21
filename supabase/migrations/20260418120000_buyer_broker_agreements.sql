-- Buyer Broker Agreements (NAR settlement compliance)
-- Every buyer client must have a signed BBA before any showing.

create table if not exists public.buyer_broker_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null,
  client_name text not null,
  commission_pct numeric(5, 2) not null default 2.5,
  term_start date not null,
  term_end date not null,
  search_area text,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists bba_client_idx
  on public.buyer_broker_agreements (client_id);
create index if not exists bba_agent_idx
  on public.buyer_broker_agreements (agent_id);

-- One live agreement per client (latest term window). If you need amendments,
-- insert a new row and UI should show the newest by signed_at.
create unique index if not exists bba_client_unique
  on public.buyer_broker_agreements (client_id);

alter table public.buyer_broker_agreements enable row level security;

drop policy if exists "bba_agent_select" on public.buyer_broker_agreements;
create policy "bba_agent_select"
  on public.buyer_broker_agreements
  for select
  using (agent_id = auth.uid());

drop policy if exists "bba_agent_insert" on public.buyer_broker_agreements;
create policy "bba_agent_insert"
  on public.buyer_broker_agreements
  for insert
  with check (agent_id = auth.uid());

drop policy if exists "bba_agent_update" on public.buyer_broker_agreements;
create policy "bba_agent_update"
  on public.buyer_broker_agreements
  for update
  using (agent_id = auth.uid());

drop policy if exists "bba_agent_delete" on public.buyer_broker_agreements;
create policy "bba_agent_delete"
  on public.buyer_broker_agreements
  for delete
  using (agent_id = auth.uid());

comment on table public.buyer_broker_agreements is
  'NJ Buyer Broker Agreement records — one per client, required before any buyer showing per NAR settlement rules.';
