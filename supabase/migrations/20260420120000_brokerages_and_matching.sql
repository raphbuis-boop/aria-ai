-- ============================================================================
-- Brokerages, custom BBA templates, and smart vicinity/range matching.
--
-- For v1 we model "one agent = one brokerage" (a default brokerage is
-- lazy-created on first BBA/settings access via lib/brokerages.ts). The table
-- is future-proofed for multi-agent brokerages via the agent_profiles.brokerage_id
-- foreign key.
--
-- ORDERING NOTE: RLS policies that reference `agent_profiles.brokerage_id`
-- are deferred until AFTER the column has been added. Postgres resolves
-- column references at CREATE POLICY time, so creating policies first and
-- the column afterwards fails with "column ap.brokerage_id does not exist".
-- The structure of this file is therefore:
--   1. DDL only (tables, columns, indexes, backfill)
--   2. All RLS + policies last
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1a. brokerages table (no policies yet — those need agent_profiles.brokerage_id)
-- ---------------------------------------------------------------------------
create table if not exists public.brokerages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_agent_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists brokerages_owner_idx
  on public.brokerages (owner_agent_id);

-- ---------------------------------------------------------------------------
-- 1b. agent_profiles.brokerage_id
-- ---------------------------------------------------------------------------
alter table public.agent_profiles
  add column if not exists brokerage_id uuid references public.brokerages(id)
    on delete set null;

create index if not exists agent_profiles_brokerage_idx
  on public.agent_profiles (brokerage_id);

-- ---------------------------------------------------------------------------
-- 1c. clients.brokerage_id (future-proofing; matching still scopes by agent_id)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists brokerage_id uuid references public.brokerages(id)
    on delete set null;

create index if not exists clients_brokerage_idx
  on public.clients (brokerage_id);

-- ---------------------------------------------------------------------------
-- 1d. Smart matching columns on clients
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists preferred_towns text[],
  add column if not exists nearby_towns_ok boolean not null default false,
  add column if not exists budget_flex_pct numeric not null default 10,
  add column if not exists bed_flex integer not null default 1,
  add column if not exists bath_flex numeric not null default 0.5;

-- Backfill preferred_towns from the existing single `town` column so the new
-- matching code always has at least one town to work with.
update public.clients
set preferred_towns = array[town]
where town is not null
  and (preferred_towns is null or array_length(preferred_towns, 1) is null);

-- ---------------------------------------------------------------------------
-- 1e. BBA templates table (per brokerage) — DDL only, policies below
-- ---------------------------------------------------------------------------
create table if not exists public.brokerage_bba_templates (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  template_name text not null,
  file_url text,                       -- optional public URL (unused when bucket is private)
  storage_path text not null,          -- path inside the `bba-templates` bucket
  is_default boolean not null default false,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bba_templates_brokerage_idx
  on public.brokerage_bba_templates (brokerage_id);
create index if not exists bba_templates_default_idx
  on public.brokerage_bba_templates (brokerage_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- 1f. buyer_broker_agreements: link to template + store signed PDF
-- ---------------------------------------------------------------------------
alter table public.buyer_broker_agreements
  add column if not exists template_id uuid references public.brokerage_bba_templates(id)
    on delete set null,
  add column if not exists signed_file_url text,
  add column if not exists signed_storage_path text;

-- ===========================================================================
-- 2. RLS + policies (run AFTER all columns they reference exist)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 2a. brokerages
-- ---------------------------------------------------------------------------
alter table public.brokerages enable row level security;

drop policy if exists brokerages_member_select on public.brokerages;
drop policy if exists brokerages_owner_write on public.brokerages;

-- Any agent whose agent_profiles.brokerage_id points here can read it.
-- The owner_agent_id has implicit membership even before their agent_profile
-- is updated (first-write convenience).
create policy brokerages_member_select on public.brokerages
  for select
  using (
    owner_agent_id = auth.uid()
    or exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerages.id
    )
  );

create policy brokerages_owner_write on public.brokerages
  for all
  using (owner_agent_id = auth.uid())
  with check (owner_agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2b. brokerage_bba_templates
-- ---------------------------------------------------------------------------
alter table public.brokerage_bba_templates enable row level security;

drop policy if exists bba_tpl_member_select on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_insert on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_update on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_delete on public.brokerage_bba_templates;

-- Any agent whose profile is a member of this brokerage may read / write.
create policy bba_tpl_member_select on public.brokerage_bba_templates
  for select
  using (
    exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerage_bba_templates.brokerage_id
    )
  );

create policy bba_tpl_member_insert on public.brokerage_bba_templates
  for insert
  with check (
    agent_id = auth.uid()
    and exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerage_bba_templates.brokerage_id
    )
  );

create policy bba_tpl_member_update on public.brokerage_bba_templates
  for update
  using (
    exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerage_bba_templates.brokerage_id
    )
  )
  with check (
    exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerage_bba_templates.brokerage_id
    )
  );

create policy bba_tpl_member_delete on public.brokerage_bba_templates
  for delete
  using (
    exists (
      select 1 from public.agent_profiles ap
      where ap.id = auth.uid() and ap.brokerage_id = brokerage_bba_templates.brokerage_id
    )
  );
