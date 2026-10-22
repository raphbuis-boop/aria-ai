-- Brokerage tenancy: an agent can't join, read or change another brokerage.
-- Runs as the superuser for setup and switches to the `authenticated` role
-- (RLS applies) for each actor, the way PostgREST does.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ── Fixture ────────────────────────────────────────────────────────────────
--   A: owner of brokerage X     C: agent in brokerage X
--   B: owner of brokerage Y     D: signed up, no profile or brokerage yet
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@x.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@y.test'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@x.test'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@z.test');

insert into public.brokerages (id, name, owner_agent_id) values
  ('10000000-0000-0000-0000-0000000000a0', 'Brokerage X', 'a0000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-0000000000b0', 'Brokerage Y', 'b0000000-0000-0000-0000-00000000000b');

insert into public.agent_profiles (id, full_name, brokerage_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'Agent A', '10000000-0000-0000-0000-0000000000a0'),
  ('b0000000-0000-0000-0000-00000000000b', 'Agent B', '20000000-0000-0000-0000-0000000000b0'),
  ('c0000000-0000-0000-0000-00000000000c', 'Agent C', '10000000-0000-0000-0000-0000000000a0');

insert into public.brokerage_members (brokerage_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000a0', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-0000000000a0', 'c0000000-0000-0000-0000-00000000000c', 'agent'),
  ('20000000-0000-0000-0000-0000000000b0', 'b0000000-0000-0000-0000-00000000000b', 'owner');

insert into public.brokerage_bba_templates (id, brokerage_id, agent_id, template_name, storage_path, is_default) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a0', 'a0000000-0000-0000-0000-00000000000a', 'X BBA', 'x/1.pdf', true),
  ('2b000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000b0', 'b0000000-0000-0000-0000-00000000000b', 'Y BBA', 'y/2.pdf', true);

-- ── Agent B (outsider to X) ────────────────────────────────────────────────
set role authenticated;
set "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-00000000000b';

-- The audit's attack: point my profile at brokerage X.
do $$
begin
  update public.agent_profiles set brokerage_id = '10000000-0000-0000-0000-0000000000a0'
  where id = 'b0000000-0000-0000-0000-00000000000b';
  raise exception 'FAIL: agent changed their own brokerage_id';
exception when insufficient_privilege then null;
end $$;

-- Or grant myself membership directly.
do $$
begin
  insert into public.brokerage_members (brokerage_id, user_id, role)
  values ('10000000-0000-0000-0000-0000000000a0', 'b0000000-0000-0000-0000-00000000000b', 'admin');
  raise exception 'FAIL: agent inserted their own membership';
exception when insufficient_privilege then null;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.brokerage_bba_templates;
  if n <> 1 then raise exception 'FAIL: B sees % templates, expected only Y''s 1', n; end if;
  select count(*) into n from public.brokerage_bba_templates where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  if n <> 0 then raise exception 'FAIL: B can read brokerage X templates'; end if;

  select count(*) into n from public.brokerages;
  if n <> 1 then raise exception 'FAIL: B sees % brokerages, expected 1', n; end if;

  select count(*) into n from public.brokerage_members;
  if n <> 1 then raise exception 'FAIL: B sees % memberships, expected own 1', n; end if;

  delete from public.brokerage_bba_templates where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  update public.brokerages set name = 'pwned' where id = '10000000-0000-0000-0000-0000000000a0';
end $$;

do $$
begin
  insert into public.brokerage_bba_templates (brokerage_id, agent_id, template_name, storage_path)
  values ('10000000-0000-0000-0000-0000000000a0', 'b0000000-0000-0000-0000-00000000000b', 'evil', 'x/evil.pdf');
  raise exception 'FAIL: B inserted a template into brokerage X';
exception when insufficient_privilege then null;
end $$;

-- Normal profile edits still work (onboarding upserts, settings updates).
insert into public.agent_profiles (id, full_name) values ('b0000000-0000-0000-0000-00000000000b', 'Agent B Renamed')
on conflict (id) do update set full_name = excluded.full_name;
update public.agent_profiles set phone = '+12015550100' where id = 'b0000000-0000-0000-0000-00000000000b';

-- ── Agent D (new user) can't create a profile already pointing at X ───────
set "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-00000000000d';
do $$
begin
  insert into public.agent_profiles (id, full_name, brokerage_id)
  values ('d0000000-0000-0000-0000-00000000000d', 'Agent D', '10000000-0000-0000-0000-0000000000a0');
  raise exception 'FAIL: new profile created with a foreign brokerage_id';
exception when insufficient_privilege then null;
end $$;
insert into public.agent_profiles (id, full_name) values ('d0000000-0000-0000-0000-00000000000d', 'Agent D');

-- ── Agent C (member, not admin, of X) ──────────────────────────────────────
set "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-00000000000c';
do $$
declare n int;
begin
  select count(*) into n from public.brokerage_bba_templates where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  if n <> 1 then raise exception 'FAIL: member C can''t see X template'; end if;
  select count(*) into n from public.brokerage_members where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  if n <> 2 then raise exception 'FAIL: member C sees % of X''s 2 members', n; end if;

  delete from public.brokerage_bba_templates where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  update public.brokerage_bba_templates set template_name = 'changed' where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
end $$;

-- ── Agent A (owner of X) ───────────────────────────────────────────────────
set "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-00000000000a';
update public.brokerage_bba_templates set template_name = 'X BBA v2' where id = '1a000000-0000-0000-0000-000000000001';
update public.brokerages set name = 'Brokerage X LLC' where id = '10000000-0000-0000-0000-0000000000a0';

reset role;
reset "request.jwt.claim.sub";

do $$
declare n int; nm text;
begin
  select count(*) into n from public.brokerage_bba_templates where brokerage_id = '10000000-0000-0000-0000-0000000000a0';
  if n <> 1 then raise exception 'FAIL: brokerage X template was deleted by a non-admin'; end if;
  select template_name into nm from public.brokerage_bba_templates where id = '1a000000-0000-0000-0000-000000000001';
  if nm <> 'X BBA v2' then raise exception 'FAIL: owner rename lost or non-admin rename applied (%)', nm; end if;
  select name into nm from public.brokerages where id = '10000000-0000-0000-0000-0000000000a0';
  if nm <> 'Brokerage X LLC' then raise exception 'FAIL: brokerage name is %', nm; end if;
  select count(*) into n from public.brokerage_members where user_id = 'b0000000-0000-0000-0000-00000000000b';
  if n <> 1 then raise exception 'FAIL: B membership count %', n; end if;
end $$;

-- ── Backfill: re-running the migration over legacy-style data ─────────────
-- E owns brokerage Z but has no membership row yet (pre-migration state);
-- F's profile points at Z without owning it (the exploit's footprint).
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000e', 'e@z.test'),
  ('f0000000-0000-0000-0000-00000000000f', 'f@z.test');
insert into public.brokerages (id, name, owner_agent_id) values
  ('30000000-0000-0000-0000-0000000000e0', 'Brokerage Z', 'e0000000-0000-0000-0000-00000000000e');
insert into public.agent_profiles (id, full_name, brokerage_id) values
  ('e0000000-0000-0000-0000-00000000000e', 'Agent E', '30000000-0000-0000-0000-0000000000e0'),
  ('f0000000-0000-0000-0000-00000000000f', 'Agent F', '30000000-0000-0000-0000-0000000000e0');

\ir ../migrations/20261022130000_brokerage_members.sql

do $$
declare r text; n int;
begin
  select role into r from public.brokerage_members
  where user_id = 'e0000000-0000-0000-0000-00000000000e' and brokerage_id = '30000000-0000-0000-0000-0000000000e0';
  if r is distinct from 'owner' then raise exception 'FAIL: owner E not backfilled (role %)', r; end if;

  select count(*) into n from public.brokerage_members where user_id = 'f0000000-0000-0000-0000-00000000000f';
  if n <> 0 then raise exception 'FAIL: F was granted membership from a self-assigned pointer'; end if;

  select count(*) into n from public.brokerage_membership_review
  where user_id = 'f0000000-0000-0000-0000-00000000000f' and claimed_brokerage_id = '30000000-0000-0000-0000-0000000000e0';
  if n <> 1 then raise exception 'FAIL: F not recorded for review'; end if;

  -- Re-running didn't disturb existing memberships.
  select count(*) into n from public.brokerage_members;
  if n <> 4 then raise exception 'FAIL: % memberships after re-run, expected 4', n; end if;
end $$;
