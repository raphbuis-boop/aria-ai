-- Dismissed/snoozed revenue opportunity cards
-- item_id matches the deterministic IDs in lib/today-items.ts
--   e.g. "hot-<client_id>", "bba-<client_id>", "match-<client_id>"
-- dismiss_until: item reappears after this timestamp (snooze = 24h, long-dismiss = 7d)

create table if not exists public.dismissed_opportunities (
  id           uuid        primary key default gen_random_uuid(),
  agent_id     uuid        not null references auth.users(id) on delete cascade,
  item_id      text        not null,
  dismiss_until timestamptz not null,
  created_at   timestamptz not null default now(),
  unique(agent_id, item_id)
);

alter table public.dismissed_opportunities enable row level security;

create policy "agents manage own dismissals"
  on public.dismissed_opportunities
  for all
  using  (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);
