-- Objects the application code reads or writes. A migration change that
-- drops one of these (or a fresh database missing one) fails CI here.
do $$
declare
  missing text[] := '{}';
  t text;
  c text[];
begin
  foreach t in array array[
    'agent_profiles', 'clients', 'properties', 'activities', 'property_matches', 'showings',
    'transactions', 'tasks', 'listings', 'referrals', 'waitlist', 'buyer_broker_agreements',
    'brokerages', 'brokerage_bba_templates', 'client_documents', 'client_deals',
    'user_saved_properties', 'idx_listing_inquiries', 'notifications', 'gmail_integrations',
    'dismissed_opportunities', 'client_engagement_events', 'bba_requests', 'market_data'
  ] loop
    if to_regclass('public.' || t) is null then missing := missing || ('table ' || t); end if;
  end loop;

  foreach c slice 1 in array array[
    array['clients', 'portal_token'],
    array['clients', 'brokerage_id'],
    array['clients', 'lead_source'],
    array['agent_profiles', 'brokerage_id'],
    array['activities', 'metadata']
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = c[1] and column_name = c[2]
    ) then
      missing := missing || ('column ' || c[1] || '.' || c[2]);
    end if;
  end loop;

  foreach t in array array['bba-templates', 'client-documents', 'files'] loop
    if not exists (select 1 from storage.buckets where id = t) then missing := missing || ('bucket ' || t); end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'Missing schema objects: %', array_to_string(missing, ', ');
  end if;
end $$;
