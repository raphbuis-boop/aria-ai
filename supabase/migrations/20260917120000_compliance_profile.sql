-- Single source of truth for publicly-displayed real-estate compliance facts
-- (agent/brokerage identity, license, contact, Fair Housing statement).
-- Replaces the hardcoded constants previously in lib/compliance.ts.
--
-- Modeled as a singleton row rather than scoped to agent_profiles: the
-- compliance footer/IDX notice are rendered on fully public, unauthenticated
-- routes (property search, policy pages) with no signed-in user in context,
-- and the app is single-tenant in practice today. Any authenticated user can
-- edit it via Settings → Compliance — there is currently no per-brokerage
-- multi-tenancy concept for this data to scope against.

create table if not exists public.compliance_profile (
  id smallint primary key default 1,
  legal_name text,
  brokerage_name text,
  license_number text,
  license_state text,
  phone text,
  email text,
  business_address text,
  fair_housing_statement text,
  support_email text,
  support_phone text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint compliance_profile_singleton check (id = 1)
);

insert into public.compliance_profile (id)
values (1)
on conflict (id) do nothing;

alter table public.compliance_profile enable row level security;

-- Publicly readable: this is exactly the data previously hardcoded and
-- rendered on unauthenticated pages, so public select is intentional.
drop policy if exists compliance_profile_public_read on public.compliance_profile;
create policy compliance_profile_public_read on public.compliance_profile
  for select
  using (true);

-- Any signed-in account holder can update it (see note above on tenancy).
drop policy if exists compliance_profile_authenticated_write on public.compliance_profile;
create policy compliance_profile_authenticated_write on public.compliance_profile
  for update
  to authenticated
  using (true)
  with check (true);
