-- ============================================================================
-- BASELINE SCHEMA — versioned source of truth for Aria's core tables.
--
-- WHY THIS FILE EXISTS
--   The core tables (agent_profiles, clients, properties, activities,
--   property_matches, showings, transactions, tasks, listings, referrals) were
--   originally created directly in the Supabase dashboard and never committed
--   to version control. Every later migration in this folder only ALTERs them
--   (`add column if not exists ...`), assuming they already exist. This file
--   reconstructs those base tables from the columns actually used in the code
--   (app/api/seed/route.ts, the dashboard pages, lib/matchProperties.ts, etc.).
--
-- ORDERING & IDEMPOTENCY
--   The filename timestamp (00000000000000) sorts BEFORE every other migration,
--   so this runs first on a fresh database. Every statement is guarded with
--   `if not exists` / `drop ... if exists`, so:
--     • On a fresh DB → these tables are created, then later migrations layer
--       their additional columns (brokerage_id, preferred_towns, client_role,
--       direction, onboarding_complete, …) on top via their own `add column
--       if not exists` statements.
--     • On the existing production DB → every `create table if not exists`
--       is a no-op, so nothing is destroyed.
--
-- SCOPE NOTE
--   Columns that are added by an existing later migration are intentionally
--   OMITTED here (they belong to that migration). Examples deliberately left
--   out of this baseline:
--     clients:        brokerage_id, preferred_towns, nearby_towns_ok,
--                     budget_flex_pct, bed_flex, bath_flex (brokerages_and_matching),
--                     client_role (showings_status_client_role),
--                     birthday, home_purchase_date (clients_birthday_home_purchase)
--     agent_profiles: brokerage_id (brokerages_and_matching),
--                     onboarding_complete (onboarding_complete)
--     activities:     direction, external_id (activities_direction)
--     showings:       status, notes (showings_status_client_role)
--   Columns the code uses that NO migration adds (e.g. clients.automation_day,
--   tasks.ai_generated) ARE included here — that is the whole point of the file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- agent_profiles  (1:1 with auth.users via shared id)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  voice_samples text[],            -- up to 5 SMS writing samples for tone matching
  tone_analysis text,              -- AI-generated tone summary
  license_state text default 'NJ', -- see supabase/license_state.sql (never tracked)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.agent_profiles enable row level security;

drop policy if exists agent_profiles_self_all on public.agent_profiles;
create policy agent_profiles_self_all on public.agent_profiles
  for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- clients  (the agent's contacts / leads)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  email               text,
  phone               text,
  source              text,                          -- zillow | manual | google | referral | facebook | ...
  status              text default 'new',            -- new | contacted | showing | offer | under_contract | closed | ...
  lead_score          integer,                       -- 0-10 readiness score
  town                text,                           -- legacy single-town (preferred_towns added later)
  budget_min          numeric(14, 2),
  budget_max          numeric(14, 2),
  beds_wanted         integer,
  baths_wanted        numeric(4, 1),
  notes               text,
  last_engagement_at  timestamptz,                    -- last inbound/outbound touch
  automation_day      integer not null default 0,     -- drip-sequence cursor (api/automation/run)
  last_automation_at  timestamptz,                    -- last time an automation fired
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists clients_agent_idx on public.clients (agent_id);
create index if not exists clients_agent_lead_score_idx
  on public.clients (agent_id, lead_score desc);

alter table public.clients enable row level security;

drop policy if exists clients_owner_all on public.clients;
create policy clients_owner_all on public.clients
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- properties  (listings cached/owned by the agent; matched against clients)
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references auth.users(id) on delete cascade,
  address       text not null,
  town          text,
  price         numeric(14, 2),
  beds          integer,
  baths         numeric(4, 1),
  sqft          integer,
  description   text,
  mls_number    text,                              -- SimplyRETS listing id when sourced from MLS
  status        text default 'available',          -- available | pending | sold | off_market | archived
  property_type text,                              -- single_family | condo | ...
  photos        jsonb default '[]'::jsonb,         -- array of photo URLs
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists properties_agent_idx on public.properties (agent_id);
create index if not exists properties_agent_mls_idx
  on public.properties (agent_id, mls_number);

alter table public.properties enable row level security;

drop policy if exists properties_owner_all on public.properties;
create policy properties_owner_all on public.properties
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activities  (per-client timeline: notes, calls, texts, emails, AI drafts)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  agent_id   uuid not null references auth.users(id) on delete cascade,
  type       text not null,                 -- note | call | text | email | showing | offer | automation
  body       text,
  ai_draft   boolean not null default false, -- generated by AI, awaiting approval
  approved   boolean not null default false, -- agent approved the draft
  sent       boolean not null default false, -- actually delivered (Twilio/email)
  created_at timestamptz not null default now()
);

create index if not exists activities_client_idx
  on public.activities (client_id, created_at desc);
create index if not exists activities_agent_idx
  on public.activities (agent_id, created_at desc);

alter table public.activities enable row level security;

drop policy if exists activities_owner_all on public.activities;
create policy activities_owner_all on public.activities
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- property_matches  (scored client↔property pairs from lib/matchProperties.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.property_matches (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  agent_id      uuid not null references auth.users(id) on delete cascade,
  match_score   integer not null,                  -- 0-100 weighted score
  match_reasons jsonb default '[]'::jsonb,          -- array of short reason strings
  notified      boolean not null default false,     -- has the agent been alerted
  created_at    timestamptz not null default now()
);

create index if not exists property_matches_agent_idx
  on public.property_matches (agent_id, created_at desc);
create index if not exists property_matches_client_idx
  on public.property_matches (client_id);
create index if not exists property_matches_property_idx
  on public.property_matches (property_id);

alter table public.property_matches enable row level security;

drop policy if exists property_matches_owner_all on public.property_matches;
create policy property_matches_owner_all on public.property_matches
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- showings  (scheduled/past property tours; status + notes added later)
-- ---------------------------------------------------------------------------
create table if not exists public.showings (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  agent_id        uuid not null references auth.users(id) on delete cascade,
  address         text,
  showing_date    timestamptz,
  client_feedback text,                 -- raw feedback after the tour
  ai_summary      text,                 -- AI-summarized takeaways
  next_action     text,                 -- recommended follow-up
  created_at      timestamptz not null default now()
);

create index if not exists showings_agent_date_idx
  on public.showings (agent_id, showing_date);
create index if not exists showings_client_idx on public.showings (client_id);

alter table public.showings enable row level security;

drop policy if exists showings_owner_all on public.showings;
create policy showings_owner_all on public.showings
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions  (deals under contract → closing milestone tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients(id) on delete cascade,
  agent_id                 uuid not null references auth.users(id) on delete cascade,
  address                  text,
  contract_price           numeric(14, 2),
  closing_date             timestamptz,
  inspection_date          timestamptz,
  appraisal_date           timestamptz,
  mortgage_commitment_date timestamptz,
  attorney_name            text,
  attorney_email           text,
  lender_name              text,
  lender_email             text,
  status                   text default 'active',   -- active | archived | closed
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists transactions_agent_closing_idx
  on public.transactions (agent_id, closing_date);
create index if not exists transactions_client_idx on public.transactions (client_id);

alter table public.transactions enable row level security;

drop policy if exists transactions_owner_all on public.transactions;
create policy transactions_owner_all on public.transactions
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- tasks  (client next-action tracking)
--
-- NOTE: There is also a later migration (20260506120000_tasks_table.sql) that
-- creates this table WITHOUT the `ai_generated` column that the code actually
-- writes (app/api/seed/route.ts, app/api/automation/run/route.ts). Defining the
-- full table here — including `ai_generated` — guarantees the column exists on
-- fresh provisioning; the later `create table if not exists` then no-ops.
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  agent_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  due_at       timestamptz,
  done         boolean not null default false,
  ai_generated boolean not null default false,  -- created by an automation/AI flow
  created_at   timestamptz not null default now()
);

create index if not exists tasks_client_id_idx on public.tasks (client_id);
create index if not exists tasks_agent_id_idx  on public.tasks (agent_id);

alter table public.tasks enable row level security;

drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- listings  (the agent's OWN listings + AI-generated marketing content)
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references auth.users(id) on delete cascade,
  address             text not null,
  price               numeric(14, 2),
  beds                integer,
  baths               numeric(4, 1),
  sqft                integer,
  description         text,
  mls_description     text,                          -- AI-written MLS remarks
  instagram_captions  jsonb,                          -- { funny, professional, teaser }
  sms_blast           text,                           -- AI-written SMS blast copy
  photos              jsonb default '[]'::jsonb,
  view_count          integer not null default 0,
  is_featured         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists listings_agent_idx on public.listings (agent_id);

alter table public.listings enable row level security;

drop policy if exists listings_owner_all on public.listings;
create policy listings_owner_all on public.listings
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- referrals  (agent-to-agent client referrals with a fee split)
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  from_agent_id        uuid not null references auth.users(id) on delete cascade,
  to_agent_id          uuid not null references auth.users(id) on delete cascade,
  client_name          text,
  client_phone         text,
  client_email         text,
  town                 text,
  budget_max           numeric(14, 2),
  notes                text,
  status               text default 'pending',    -- pending | accepted | declined
  referral_fee_percent numeric(5, 2) default 25,
  created_at           timestamptz not null default now()
);

create index if not exists referrals_from_agent_idx on public.referrals (from_agent_id);
create index if not exists referrals_to_agent_idx   on public.referrals (to_agent_id);

alter table public.referrals enable row level security;

-- A referral is visible to either side of the hand-off.
drop policy if exists referrals_participant_select on public.referrals;
create policy referrals_participant_select on public.referrals
  for select
  to authenticated
  using (from_agent_id = auth.uid() or to_agent_id = auth.uid());

-- The sender owns writes; the recipient updates status (accept/decline).
drop policy if exists referrals_sender_insert on public.referrals;
create policy referrals_sender_insert on public.referrals
  for insert
  to authenticated
  with check (from_agent_id = auth.uid());

drop policy if exists referrals_participant_update on public.referrals;
create policy referrals_participant_update on public.referrals
  for update
  to authenticated
  using (from_agent_id = auth.uid() or to_agent_id = auth.uid())
  with check (from_agent_id = auth.uid() or to_agent_id = auth.uid());

drop policy if exists referrals_sender_delete on public.referrals;
create policy referrals_sender_delete on public.referrals
  for delete
  to authenticated
  using (from_agent_id = auth.uid());
