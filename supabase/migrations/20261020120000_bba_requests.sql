-- BBA signing requests: the agent sets the terms, the buyer only signs.
--
-- Each request carries a random token for the public /bba/sign/<token> link
-- (replacing the old link keyed by client id). A link expires 7 days after it
-- is created (expires_at, set by the app) and is used up once signed. Creating
-- a new request for a client voids any still-open one, so only the latest
-- terms can be signed.

create table if not exists public.bba_requests (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique,
  client_id      uuid not null references public.clients(id) on delete cascade,
  agent_id       uuid not null references auth.users(id) on delete cascade,
  agent_name     text not null,
  commission_pct numeric(5, 2) not null check (commission_pct > 0 and commission_pct <= 10),
  term_start     date not null,
  term_end       date not null,
  search_area    text,
  template_id    uuid references public.brokerage_bba_templates(id) on delete set null,
  expires_at     timestamptz not null,
  signed_at      timestamptz,
  voided_at      timestamptz,
  bba_id         uuid references public.buyer_broker_agreements(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint bba_requests_term_check check (term_end > term_start)
);

create index if not exists bba_requests_client_idx
  on public.bba_requests (client_id, created_at desc);

alter table public.bba_requests enable row level security;

-- Agents create, read and void their own requests. The public signing page
-- reads and signs through the server (service role) by token only.
drop policy if exists bba_requests_agent_select on public.bba_requests;
create policy bba_requests_agent_select on public.bba_requests
  for select using (agent_id = auth.uid());

drop policy if exists bba_requests_agent_insert on public.bba_requests;
create policy bba_requests_agent_insert on public.bba_requests
  for insert with check (agent_id = auth.uid());

drop policy if exists bba_requests_agent_update on public.bba_requests;
create policy bba_requests_agent_update on public.bba_requests
  for update using (agent_id = auth.uid()) with check (agent_id = auth.uid());

comment on table public.bba_requests is
  'Agent-set Buyer Broker Agreement terms behind an expiring, single-use signing link (/bba/sign/<token>).';
