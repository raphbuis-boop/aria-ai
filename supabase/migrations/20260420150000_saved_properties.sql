-- =====================================================================
-- User-saved MLS properties (watchlist/bookmarks)
-- =====================================================================
-- Agents bookmark live MLS listings they want to revisit. We cache a
-- snapshot of the listing payload so the "Saved" page can render even
-- when the upstream MLS is unavailable. When the agent opens a saved
-- listing, we can still re-fetch a fresh copy from SimplyRETS by
-- mls_number.

create table if not exists public.user_saved_properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  mls_number text not null,
  address text,
  town text,
  price numeric(14, 2),
  beds int,
  baths numeric(4, 1),
  sqft int,
  photo_url text,
  status text,
  notes text,
  -- Full JSON snapshot of the MlsListingPayload we saved.
  snapshot jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, mls_number)
);

create index if not exists idx_user_saved_properties_agent
  on public.user_saved_properties (agent_id, saved_at desc);

alter table public.user_saved_properties enable row level security;

drop policy if exists "saved_props_select_own" on public.user_saved_properties;
create policy "saved_props_select_own"
  on public.user_saved_properties for select
  using (auth.uid() = agent_id);

drop policy if exists "saved_props_insert_own" on public.user_saved_properties;
create policy "saved_props_insert_own"
  on public.user_saved_properties for insert
  with check (auth.uid() = agent_id);

drop policy if exists "saved_props_update_own" on public.user_saved_properties;
create policy "saved_props_update_own"
  on public.user_saved_properties for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

drop policy if exists "saved_props_delete_own" on public.user_saved_properties;
create policy "saved_props_delete_own"
  on public.user_saved_properties for delete
  using (auth.uid() = agent_id);
