-- Multiple emails and phones per client, plus what kind of contact they are.
--
-- clients.emails / clients.phones hold every address and number we know for
-- the client (imports bring in all of them, not just the first). The existing
-- clients.email / clients.phone stay the primary ones; a trigger keeps the
-- primary inside the list whoever writes it, so lookups only need the arrays.
-- Emails are stored lowercased, phones as E.164 (+12015550134) when they
-- parse as a US/international number.
--
-- clients.contact_group: what the agent said these people are when importing
-- them — 'lead' (active lead), 'sphere' (people she knows) or 'past_client'.
-- Null = added before this existed (treated as a lead). The drip automation
-- never runs for sphere or past clients.
--
-- clients.address: home/mailing address from an imported contact.
--
-- Strictly additive: new columns, a function, a trigger and indexes. The
-- backfill only fills the new arrays.

alter table public.clients
  add column if not exists emails text[] not null default '{}',
  add column if not exists phones text[] not null default '{}',
  add column if not exists contact_group text,
  add column if not exists address text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_contact_group_check'
  ) then
    alter table public.clients
      add constraint clients_contact_group_check
      check (contact_group in ('lead', 'sphere', 'past_client'));
  end if;
end $$;

-- Same rules as formatPhoneE164 in lib/utils.ts: 10 digits → +1…, 11 digits
-- starting with 1 → +…, "+" with 10–15 digits → +digits; anything else is
-- kept as typed so nothing is lost.
create or replace function public.normalize_phone_e164(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null or btrim(raw) = '' then null
    when length(regexp_replace(raw, '\D', '', 'g')) = 10
      then '+1' || regexp_replace(raw, '\D', '', 'g')
    when length(regexp_replace(raw, '\D', '', 'g')) = 11
      and left(regexp_replace(raw, '\D', '', 'g'), 1) = '1'
      then '+' || regexp_replace(raw, '\D', '', 'g')
    when left(btrim(raw), 1) = '+'
      and length(regexp_replace(raw, '\D', '', 'g')) between 10 and 15
      then '+' || regexp_replace(raw, '\D', '', 'g')
    else btrim(raw)
  end
$$;

-- Keep the primary email/phone in the lists (first position) on every write.
create or replace function public.clients_sync_contact_points()
returns trigger
language plpgsql
as $$
declare
  e text := lower(nullif(btrim(new.email), ''));
  p text := public.normalize_phone_e164(new.phone);
begin
  new.emails := coalesce(new.emails, '{}');
  new.phones := coalesce(new.phones, '{}');
  if e is not null and not (e = any(new.emails)) then
    new.emails := array_prepend(e, new.emails);
  end if;
  if p is not null and not (p = any(new.phones)) then
    new.phones := array_prepend(p, new.phones);
  end if;
  return new;
end
$$;

drop trigger if exists clients_sync_contact_points on public.clients;
create trigger clients_sync_contact_points
  before insert or update of email, phone, emails, phones on public.clients
  for each row execute function public.clients_sync_contact_points();

-- Backfill from the existing primary email/phone.
update public.clients
set emails = array[lower(btrim(email))]
where email is not null and btrim(email) <> '' and emails = '{}';

update public.clients
set phones = array[public.normalize_phone_e164(phone)]
where phone is not null and btrim(phone) <> '' and phones = '{}';

-- "Is this person already a client?" lookups (lead intake, imports, inbound
-- texts) match on any address or number.
create index if not exists clients_emails_gin on public.clients using gin (emails);
create index if not exists clients_phones_gin on public.clients using gin (phones);

comment on column public.clients.emails is 'Every email for the client, lowercased; clients.email (primary) is always included.';
comment on column public.clients.phones is 'Every phone for the client, E.164 when parseable; clients.phone (primary) is always included.';
comment on column public.clients.contact_group is 'lead | sphere | past_client — set on import. Null = lead.';
