-- =============================================================================
-- Fix cross-tenant inquiry data leak.
-- Implements a claim-based pool model:
--   • Unclaimed rows (claimed_by_agent_id IS NULL) are visible to all agents.
--   • Once claimed, only the claiming agent + their own UPDATE/DELETE rights.
--   • Public INSERT policy from 20260505120000_inquiries_extend.sql is untouched.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.idx_listing_inquiries
  add column if not exists claimed_by_agent_id uuid
    references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Drop the USING (true) policies that allowed any agent to read/mutate
--    every other agent's inquiries.
-- ---------------------------------------------------------------------------
drop policy if exists "auth_select_inquiries" on public.idx_listing_inquiries;
drop policy if exists "auth_update_inquiries" on public.idx_listing_inquiries;
drop policy if exists "auth_delete_inquiries" on public.idx_listing_inquiries;

-- ---------------------------------------------------------------------------
-- 3. New SELECT: see unclaimed pool OR rows the caller has claimed.
-- ---------------------------------------------------------------------------
create policy "agent_select_inquiries"
  on public.idx_listing_inquiries
  for select
  to authenticated
  using (
    claimed_by_agent_id is null
    or claimed_by_agent_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. New UPDATE: caller can mutate their own claimed rows, OR claim an
--    unclaimed row. WITH CHECK ensures the row always ends up owned by
--    the caller — prevents an agent from assigning a row to someone else.
-- ---------------------------------------------------------------------------
create policy "agent_update_inquiries"
  on public.idx_listing_inquiries
  for update
  to authenticated
  using (
    claimed_by_agent_id = auth.uid()
    or claimed_by_agent_id is null
  )
  with check (
    claimed_by_agent_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. New DELETE: only the claiming agent.
-- ---------------------------------------------------------------------------
create policy "agent_delete_inquiries"
  on public.idx_listing_inquiries
  for delete
  to authenticated
  using (
    claimed_by_agent_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 6. Index for dashboard queries filtered by claiming agent.
-- ---------------------------------------------------------------------------
create index if not exists idx_inquiries_claimed_by
  on public.idx_listing_inquiries (claimed_by_agent_id);
