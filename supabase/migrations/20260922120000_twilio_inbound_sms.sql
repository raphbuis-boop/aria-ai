-- Aria SMS lead flow: Twilio outbound/inbound, AI conversation, showing
-- approvals and BBA follow-through. Everything reuses the existing
-- clients / activities / showings / notifications / tasks / BBA tables;
-- this migration is strictly additive (new columns + indexes only; no
-- drops, no data changes). Notifications reuse existing kinds.

-- agent_profiles.twilio_from_number: per-agent sending number. Falls back to
--   TWILIO_MESSAGING_SERVICE_SID / TWILIO_FROM_NUMBER env vars when unset.
--   Also used to route an inbound text to the right agent (matched on `To`).
alter table public.agent_profiles
  add column if not exists twilio_from_number text;

-- clients.timeline: buying timeline extracted from conversation (e.g. "next
--   3 months"). Not modeled anywhere else in the schema.
-- clients.sms_opted_out: set when the client texts STOP; Aria never texts
--   an opted-out client again until they text START.
alter table public.clients
  add column if not exists timeline text,
  add column if not exists sms_opted_out boolean not null default false;

create index if not exists clients_phone_idx on public.clients (phone);

-- activities.metadata: small bag for AI bookkeeping (e.g. drafted-reply
-- intent/rationale, recommended property ids) that doesn't belong in the
-- message body itself.
alter table public.activities
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Twilio MessageSid dedupe: a retried webhook must never double-log or
-- double-reply.
create unique index if not exists activities_external_id_key
  on public.activities (external_id)
  where external_id is not null;

-- Showing requests made by a client over SMS land as status = 'requested'
-- and wait for the agent to approve (-> 'scheduled') or decline
-- (-> 'declined'). showings.status has no check constraint, so no change
-- is needed for the new values.
alter table public.showings
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists requested_time_text text,
  add column if not exists approval_task_id uuid references public.tasks(id) on delete set null;
