-- Client engagement events — behavioral signal for real lead heat (BUILD.md P1).
-- Every event ties to a specific client (attributed via the per-client portal_token),
-- so lead scoring can react to what a client actually does: opening the portal,
-- viewing listings, favoriting, inquiring. Inserted server-side via the service-role
-- admin client (portal viewers are unauthenticated clients); agents read their own.

create table if not exists public.client_engagement_events (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  event_type      text not null
                    check (event_type in ('portal_open','view','favorite','inquiry','search','alert_open')),
  listing_id      text,
  listing_address text,
  mls_number      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists client_engagement_events_agent_recent_idx
  on public.client_engagement_events (agent_id, created_at desc);
create index if not exists client_engagement_events_client_idx
  on public.client_engagement_events (client_id, created_at desc);

alter table public.client_engagement_events enable row level security;

-- Agents read their own events. Writes go through the service-role admin client
-- (the public portal has no authenticated session), which bypasses RLS.
drop policy if exists client_engagement_events_owner_read on public.client_engagement_events;
create policy client_engagement_events_owner_read on public.client_engagement_events
  for select
  to authenticated
  using (agent_id = auth.uid());

comment on table public.client_engagement_events is
  'Per-client behavioral events (portal opens, listing views, favorites, inquiries) feeding computeLeadScore(). Written via service role from the portal; read by the owning agent.';
