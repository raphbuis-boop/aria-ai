-- rate_limit_hit: counts per key and window; only the server may call it.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

set role service_role;
do $$
declare ok boolean; i int;
begin
  for i in 1..3 loop
    select public.rate_limit_hit('test:1.2.3.4', 3600, 3) into ok;
    if not ok then raise exception 'FAIL: hit % of 3 was refused', i; end if;
  end loop;
  select public.rate_limit_hit('test:1.2.3.4', 3600, 3) into ok;
  if ok then raise exception 'FAIL: 4th hit allowed past the limit of 3'; end if;

  -- Other callers have their own budget.
  select public.rate_limit_hit('test:5.6.7.8', 3600, 3) into ok;
  if not ok then raise exception 'FAIL: a different key was limited'; end if;
end $$;
reset role;

set role authenticated;
do $$
begin
  perform public.rate_limit_hit('test:x', 60, 1000);
  raise exception 'FAIL: a signed-in user could call rate_limit_hit';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform count(*) from public.rate_limits;
  raise exception 'FAIL: a signed-in user could read rate_limits';
exception when insufficient_privilege then null;
end $$;
reset role;
