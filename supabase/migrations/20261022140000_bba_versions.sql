-- ============================================================================
-- Signed Buyer Broker Agreements are records: keep every version.
--
-- Before: one row per client (unique on client_id), and re-signing upserted
-- over it — the earlier signature, terms, IP/user agent and (same storage key)
-- the signed PDF were replaced. RLS also let agents insert, edit and delete
-- agreement rows directly, so a signed commission could be changed after the
-- buyer signed.
--
-- After:
--   * Many rows per client; exactly one current (superseded_at is null).
--   * A new signature supersedes the current one ('renewed'); an agent revoke
--     marks it 'revoked'. Nothing is deleted.
--   * Agents read their agreements; only the server (service role) writes,
--     through record_bba_signature(), which supersedes and inserts in one
--     transaction.
-- ============================================================================

alter table public.buyer_broker_agreements
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_reason text;

alter table public.buyer_broker_agreements
  drop constraint if exists buyer_broker_agreements_superseded_reason_check;
alter table public.buyer_broker_agreements
  add constraint buyer_broker_agreements_superseded_reason_check
    check (superseded_reason in ('renewed', 'revoked'));

drop index if exists public.bba_client_unique;

create unique index if not exists bba_client_current_key
  on public.buyer_broker_agreements (client_id)
  where superseded_at is null;

create index if not exists bba_client_history_idx
  on public.buyer_broker_agreements (client_id, signed_at desc);

comment on table public.buyer_broker_agreements is
  'NJ Buyer Broker Agreement signatures — every version kept; the row with superseded_at null is the current agreement for the client.';

-- Agents read; the server writes.
drop policy if exists bba_agent_insert on public.buyer_broker_agreements;
drop policy if exists bba_agent_update on public.buyer_broker_agreements;
drop policy if exists bba_agent_delete on public.buyer_broker_agreements;

-- ---------------------------------------------------------------------------
-- record_bba_signature(agreement jsonb): supersede the client's current
-- agreement (if any) and insert the new one, atomically. Columns not supplied
-- take their defaults; supersession columns are always cleared.
-- ---------------------------------------------------------------------------
create or replace function public.record_bba_signature(agreement jsonb)
returns public.buyer_broker_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.buyer_broker_agreements;
begin
  rec := jsonb_populate_record(null::public.buyer_broker_agreements, agreement);
  rec.id := coalesce(rec.id, gen_random_uuid());
  rec.signed_at := coalesce(rec.signed_at, now());
  rec.created_at := coalesce(rec.created_at, now());
  rec.superseded_at := null;
  rec.superseded_reason := null;

  update public.buyer_broker_agreements
     set superseded_at = rec.signed_at,
         superseded_reason = 'renewed'
   where client_id = rec.client_id
     and superseded_at is null;

  insert into public.buyer_broker_agreements
  select (rec).*
  returning * into rec;

  return rec;
end;
$$;

revoke all on function public.record_bba_signature(jsonb) from public, anon, authenticated;
grant execute on function public.record_bba_signature(jsonb) to service_role;
