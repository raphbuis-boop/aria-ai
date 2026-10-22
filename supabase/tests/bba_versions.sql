-- Signed BBAs: every version kept, one current per client, agents can't edit.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

insert into auth.users (id, email) values ('a1000000-0000-0000-0000-0000000000a1', 'agent@bba.test');
insert into public.clients (id, agent_id, name) values
  ('c1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000a1', 'Dana Buyer');

-- Server signs v1, then v2 (a renewal).
set role service_role;
select id from public.record_bba_signature(jsonb_build_object(
  'client_id', 'c1000000-0000-0000-0000-0000000000c1',
  'agent_id', 'a1000000-0000-0000-0000-0000000000a1',
  'agent_name', 'Sam Agent', 'client_name', 'Dana Buyer',
  'commission_pct', 2.5, 'term_start', '2026-01-01', 'term_end', '2026-06-30',
  'signature_data', 'data:image/png;base64,v1', 'signed_at', '2026-01-02T15:00:00Z'
)) \gset v1_
select id from public.record_bba_signature(jsonb_build_object(
  'client_id', 'c1000000-0000-0000-0000-0000000000c1',
  'agent_id', 'a1000000-0000-0000-0000-0000000000a1',
  'agent_name', 'Sam Agent', 'client_name', 'Dana Buyer',
  'commission_pct', 2.0, 'term_start', '2026-07-01', 'term_end', '2026-12-31',
  'signature_data', 'data:image/png;base64,v2', 'signed_at', '2026-07-01T15:00:00Z'
)) \gset v2_
reset role;

do $$
declare n int; cur numeric; old_reason text; old_sig text;
begin
  select count(*) into n from public.buyer_broker_agreements where client_id = 'c1000000-0000-0000-0000-0000000000c1';
  if n <> 2 then raise exception 'FAIL: % versions kept, expected 2', n; end if;

  select commission_pct into cur from public.buyer_broker_agreements
  where client_id = 'c1000000-0000-0000-0000-0000000000c1' and superseded_at is null;
  if cur <> 2.0 then raise exception 'FAIL: current agreement is %, expected the renewal', cur; end if;

  select superseded_reason, signature_data into old_reason, old_sig from public.buyer_broker_agreements
  where client_id = 'c1000000-0000-0000-0000-0000000000c1' and superseded_at is not null;
  if old_reason <> 'renewed' or old_sig <> 'data:image/png;base64,v1' then
    raise exception 'FAIL: original signature not preserved (% / %)', old_reason, old_sig;
  end if;
end $$;

-- Only one current agreement per client, even if written directly.
do $$
begin
  insert into public.buyer_broker_agreements (client_id, agent_id, agent_name, client_name, term_start, term_end, signature_data)
  values ('c1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000a1', 'x', 'y', '2026-01-01', '2026-02-01', 'z');
  raise exception 'FAIL: second current agreement accepted';
exception when unique_violation then null;
end $$;

-- The agent can read but not forge, edit, delete or call the signing function.
set role authenticated;
set "request.jwt.claim.sub" = 'a1000000-0000-0000-0000-0000000000a1';

do $$
declare n int;
begin
  select count(*) into n from public.buyer_broker_agreements;
  if n <> 2 then raise exception 'FAIL: agent sees % of their 2 agreements', n; end if;

  update public.buyer_broker_agreements set commission_pct = 9 where client_id = 'c1000000-0000-0000-0000-0000000000c1';
  delete from public.buyer_broker_agreements where client_id = 'c1000000-0000-0000-0000-0000000000c1';
end $$;

do $$
begin
  insert into public.buyer_broker_agreements (client_id, agent_id, agent_name, client_name, term_start, term_end, signature_data)
  values ('c1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000a1', 'x', 'y', '2026-01-01', '2026-02-01', 'forged');
  raise exception 'FAIL: agent inserted an agreement directly';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform public.record_bba_signature('{}'::jsonb);
  raise exception 'FAIL: agent could call record_bba_signature';
exception when insufficient_privilege then null;
end $$;

reset role;
reset "request.jwt.claim.sub";

do $$
declare n int; pct numeric;
begin
  select count(*), max(commission_pct) into n, pct from public.buyer_broker_agreements
  where client_id = 'c1000000-0000-0000-0000-0000000000c1';
  if n <> 2 or pct <> 2.5 then raise exception 'FAIL: agent changed signed records (% rows, max pct %)', n, pct; end if;
end $$;
