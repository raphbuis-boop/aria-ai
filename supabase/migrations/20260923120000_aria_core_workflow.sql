-- Aria core workflow, part 2. Strictly additive: new nullable/defaulted
-- columns and indexes only — no drops, no constraint changes, no data edits.

-- clients.lead_source: the raw lead origin ("realtor", "website", "meta",
--   "sms", ...). clients.source keeps its existing constrained vocabulary
--   (zillow/google/facebook/referral/other/manual); this preserves detail
--   that vocabulary can't express without widening its check constraint.
-- clients.aria_paused: Aria stops auto-replying (still logs inbound texts)
--   once the client needs the agent personally, until the agent resumes it.
alter table public.clients
  add column if not exists lead_source text,
  add column if not exists aria_paused boolean not null default false;

-- tasks.kind: marks tasks Aria opened for the agent ("aria_showing_approval",
-- "aria_handoff", ...) so Today can surface them as approvals. Null for all
-- existing tasks.
alter table public.tasks
  add column if not exists kind text;

create index if not exists tasks_agent_open_kind_idx
  on public.tasks (agent_id, kind)
  where done = false and kind is not null;

-- showings.calendar_event_id: Google Calendar event created on approval
-- (only when the agent's Google connection has calendar write scope).
alter table public.showings
  add column if not exists calendar_event_id text;

create index if not exists showings_agent_requested_idx
  on public.showings (agent_id)
  where status = 'requested';
