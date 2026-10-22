-- ============================================================================
-- Brokerage membership with roles.
--
-- Before this migration, "member of brokerage X" meant agent_profiles.brokerage_id
-- = X, and agents may update their own agent_profiles row. Anyone who learned a
-- brokerage's id could set it on their profile and then read, replace or delete
-- that brokerage's BBA templates (and the API routes trusted the same column).
--
-- Membership now lives in brokerage_members, which only the server (service
-- role) writes. agent_profiles.brokerage_id stays as a cached pointer for
-- display, and a trigger stops browsers from changing it.
--
-- Existing data:
--   * Every brokerage's owner becomes its 'owner' member.
--   * Profiles pointing at a brokerage they don't own are NOT granted
--     membership (there was no legitimate way to create that link). They are
--     copied to brokerage_membership_review for a human to check; to confirm a
--     real teammate, insert their brokerage_members row with the service role.
-- ============================================================================

create table if not exists public.brokerage_members (
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'agent' check (role in ('owner', 'admin', 'agent')),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (brokerage_id, user_id)
);

-- A NJ licensee works under one broker: one brokerage per user.
create unique index if not exists brokerage_members_one_per_user
  on public.brokerage_members (user_id);

alter table public.brokerage_members enable row level security;

-- ---------------------------------------------------------------------------
-- Membership checks for policies. SECURITY DEFINER so policies on other
-- tables (and on brokerage_members itself) can call them without recursing
-- through brokerage_members' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_brokerage_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brokerage_members
    where brokerage_id = bid and user_id = auth.uid()
  );
$$;

create or replace function public.is_brokerage_admin(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brokerage_members
    where brokerage_id = bid and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_brokerage_member(uuid) from public;
revoke all on function public.is_brokerage_admin(uuid) from public;
grant execute on function public.is_brokerage_member(uuid) to authenticated, service_role;
grant execute on function public.is_brokerage_admin(uuid) to authenticated, service_role;

-- Members see their brokerage's roster. No insert/update/delete policies:
-- membership changes only through the server.
drop policy if exists brokerage_members_read on public.brokerage_members;
create policy brokerage_members_read on public.brokerage_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_brokerage_member(brokerage_id));

-- ---------------------------------------------------------------------------
-- Backfill owners (one brokerage per owner: the one their profile points at,
-- else the oldest).
-- ---------------------------------------------------------------------------
insert into public.brokerage_members (brokerage_id, user_id, role)
select distinct on (b.owner_agent_id) b.id, b.owner_agent_id, 'owner'
from public.brokerages b
left join public.agent_profiles ap on ap.id = b.owner_agent_id
order by b.owner_agent_id, (ap.brokerage_id = b.id) desc nulls last, b.created_at asc
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Record profiles that point at someone else's brokerage. Service role only.
-- ---------------------------------------------------------------------------
create table if not exists public.brokerage_membership_review (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  claimed_brokerage_id uuid,
  brokerage_owner_id   uuid,
  found_at             timestamptz not null default now()
);

alter table public.brokerage_membership_review enable row level security;
revoke all on public.brokerage_membership_review from anon, authenticated;

insert into public.brokerage_membership_review (user_id, claimed_brokerage_id, brokerage_owner_id)
select ap.id, ap.brokerage_id, b.owner_agent_id
from public.agent_profiles ap
join public.brokerages b on b.id = ap.brokerage_id
where b.owner_agent_id <> ap.id
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Policies: membership, not agent_profiles.brokerage_id.
-- ---------------------------------------------------------------------------
drop policy if exists brokerages_member_select on public.brokerages;
drop policy if exists brokerages_owner_write on public.brokerages;
drop policy if exists brokerages_admin_update on public.brokerages;

create policy brokerages_member_select on public.brokerages
  for select
  to authenticated
  using (public.is_brokerage_member(id));

-- Renaming is an admin action. Creating and deleting brokerages is server-only.
create policy brokerages_admin_update on public.brokerages
  for update
  to authenticated
  using (public.is_brokerage_admin(id))
  with check (public.is_brokerage_admin(id));

drop policy if exists bba_tpl_member_select on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_insert on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_update on public.brokerage_bba_templates;
drop policy if exists bba_tpl_member_delete on public.brokerage_bba_templates;
drop policy if exists bba_tpl_admin_insert on public.brokerage_bba_templates;
drop policy if exists bba_tpl_admin_update on public.brokerage_bba_templates;
drop policy if exists bba_tpl_admin_delete on public.brokerage_bba_templates;

-- Every member can use the brokerage's templates; only owners/admins change them.
create policy bba_tpl_member_select on public.brokerage_bba_templates
  for select
  to authenticated
  using (public.is_brokerage_member(brokerage_id));

create policy bba_tpl_admin_insert on public.brokerage_bba_templates
  for insert
  to authenticated
  with check (agent_id = auth.uid() and public.is_brokerage_admin(brokerage_id));

create policy bba_tpl_admin_update on public.brokerage_bba_templates
  for update
  to authenticated
  using (public.is_brokerage_admin(brokerage_id))
  with check (public.is_brokerage_admin(brokerage_id));

create policy bba_tpl_admin_delete on public.brokerage_bba_templates
  for delete
  to authenticated
  using (public.is_brokerage_admin(brokerage_id));

-- ---------------------------------------------------------------------------
-- agent_profiles.brokerage_id is server-managed. Browsers (anon/authenticated)
-- can still edit the rest of their own profile.
-- ---------------------------------------------------------------------------
create or replace function public.agent_profiles_guard_brokerage()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.brokerage_id is not null then
      raise exception 'agent_profiles.brokerage_id is managed by the server'
        using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.brokerage_id is distinct from old.brokerage_id then
      raise exception 'agent_profiles.brokerage_id is managed by the server'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agent_profiles_guard_brokerage on public.agent_profiles;
create trigger agent_profiles_guard_brokerage
  before insert or update on public.agent_profiles
  for each row execute function public.agent_profiles_guard_brokerage();
