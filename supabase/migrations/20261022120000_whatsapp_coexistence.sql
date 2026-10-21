-- WhatsApp Business coexistence: Aria reads the agent's 1:1 WhatsApp chats
-- with her clients (she keeps sending from the WhatsApp Business app on her
-- phone; Aria never sends through the API).
--
-- Requires 20261021120000_client_contact_points.sql (clients.phones).
-- Strictly additive: new tables, new columns, indexes and policies.
--
-- Privacy: only messages with an existing client (matched on any of their
-- clients.phones) are ever written. Messages from anyone else are dropped in
-- the webhook; the one exception is whatsapp_unknown_senders below — the
-- number and first line of a stranger's message, kept 24 hours so the agent
-- can choose to add them as a client.

-- ── Per-agent connection ────────────────────────────────────────────────────
create table if not exists public.whatsapp_connections (
  agent_id uuid primary key references auth.users(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null unique,
  business_id text,
  -- The agent's WhatsApp Business number, E.164.
  display_phone_number text,
  verified_name text,
  -- Business integration system user token, AES-256-GCM encrypted by the
  -- server (lib/whatsapp/crypto.ts, key WHATSAPP_TOKEN_KEY). Never plaintext.
  access_token_enc text not null,
  -- connected: webhooks flowing · broken: token/permission check failed or
  -- Meta reported a problem · disconnected: she removed Aria or offboarded.
  status text not null default 'connected',
  status_detail text,
  -- Contacts + chat history sync (smb_app_data) — requested once, right
  -- after onboarding. history_status: requested | in_progress | complete | declined | failed
  history_requested_at timestamptz,
  history_status text,
  last_webhook_at timestamptz,
  last_checked_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_connections_status_check') then
    alter table public.whatsapp_connections
      add constraint whatsapp_connections_status_check
      check (status in ('connected', 'broken', 'disconnected'));
  end if;
end $$;

create index if not exists whatsapp_connections_waba_idx on public.whatsapp_connections (waba_id);

alter table public.whatsapp_connections enable row level security;

drop policy if exists whatsapp_connections_owner_select on public.whatsapp_connections;
create policy whatsapp_connections_owner_select on public.whatsapp_connections
  for select to authenticated
  using (agent_id = auth.uid());

-- Writes go through the server (service role) only, and the browser can't
-- read the token column even for her own row.
revoke all on public.whatsapp_connections from anon, authenticated;
grant select (
  agent_id, waba_id, phone_number_id, business_id, display_phone_number, verified_name,
  status, status_detail, history_requested_at, history_status, last_webhook_at,
  last_checked_at, connected_at, updated_at
) on public.whatsapp_connections to authenticated;

-- ── "New number messaged you — add as client?" ──────────────────────────────
-- Only the number and the first line, for 24 hours. Deleted when she adds
-- the person, dismisses the card, or it expires (purged by the webhook and
-- whenever the cards are read).
create table if not exists public.whatsapp_unknown_senders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,               -- E.164
  first_line text,                   -- ≤ 140 chars
  message_id text,                   -- WhatsApp message id, so "Add" logs it once
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (agent_id, phone)
);

create index if not exists whatsapp_unknown_senders_expiry_idx on public.whatsapp_unknown_senders (expires_at);

alter table public.whatsapp_unknown_senders enable row level security;

drop policy if exists whatsapp_unknown_senders_owner on public.whatsapp_unknown_senders;
create policy whatsapp_unknown_senders_owner on public.whatsapp_unknown_senders
  for all to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ── Client / agent fields ───────────────────────────────────────────────────
-- clients.last_inbound_at: the last time the client messaged the agent
--   (WhatsApp today). "Replied" in the CRM.
-- clients.drip_paused_at: set when the client replies; the new-lead drip
--   (/api/automation/run) stops and their unsent drip drafts are paused.
alter table public.clients
  add column if not exists last_inbound_at timestamptz,
  add column if not exists drip_paused_at timestamptz;

-- How long a client's WhatsApp message can sit unanswered before Follow-ups
-- shows "Client messaged you, you haven't replied".
alter table public.agent_profiles
  add column if not exists whatsapp_reply_alert_hours smallint not null default 4;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agent_profiles_whatsapp_reply_alert_hours_check') then
    alter table public.agent_profiles
      add constraint agent_profiles_whatsapp_reply_alert_hours_check
      check (whatsapp_reply_alert_hours between 1 and 72);
  end if;
end $$;

-- WhatsApp messages are activities (type 'whatsapp', external_id 'wa:<id>',
-- deduped by the existing unique index on activities.external_id). The
-- client thread and Ask Aria read them by client and type.
create index if not exists activities_client_type_idx
  on public.activities (client_id, type, created_at desc);
