-- =========================================================================
-- Gmail OAuth connections, sent-email log, and per-agent email templates.
--
-- Security model for Gmail refresh tokens:
--   • Preferred: Supabase Vault (pgsodium).  Row stores only the vault
--     secret id (`vault_secret_id`).
--   • Fallback: AES-256-GCM encrypted ciphertext in `encrypted_token`
--     using the server-side env var GMAIL_ENCRYPTION_KEY.
--   • Either way, the secret columns are NEVER exposed to the
--     `authenticated` role — only the Supabase service role can read them.
-- =========================================================================

-- --------------------------------------------------------------
-- gmail_connections
-- --------------------------------------------------------------
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  email_address text not null,
  vault_secret_id uuid,
  encrypted_token text,
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (agent_id)
);

alter table public.gmail_connections enable row level security;

drop policy if exists gmail_connections_select_own on public.gmail_connections;
create policy gmail_connections_select_own
  on public.gmail_connections
  for select
  to authenticated
  using (agent_id = auth.uid());

-- No write policy for `authenticated` — inserts/updates/deletes all go
-- through the service-role admin client server-side so refresh tokens
-- never round-trip through the browser.

-- Lock down the sensitive columns.  Authenticated users can SELECT the
-- row but cannot see the encrypted token or vault id.
revoke all on public.gmail_connections from authenticated;
grant select (
  id,
  agent_id,
  email_address,
  connected_at,
  last_used_at,
  scopes,
  created_at
) on public.gmail_connections to authenticated;

-- --------------------------------------------------------------
-- sent_emails — log of emails the agent has sent via Gmail.
-- Stores only a short preview of the body; full content lives in Gmail.
-- --------------------------------------------------------------
create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  to_address text not null,
  from_address text not null,
  subject text,
  body_preview text,
  gmail_message_id text,
  gmail_thread_id text,
  property_id text,
  template_id uuid,
  sent_at timestamptz not null default now()
);

alter table public.sent_emails enable row level security;

drop policy if exists sent_emails_all_own on public.sent_emails;
create policy sent_emails_all_own
  on public.sent_emails
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create index if not exists sent_emails_agent_client_idx
  on public.sent_emails (agent_id, client_id, sent_at desc);

-- --------------------------------------------------------------
-- email_templates — per-agent, seeded on first load with 6 defaults.
-- --------------------------------------------------------------
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  system_key text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

drop policy if exists email_templates_all_own on public.email_templates;
create policy email_templates_all_own
  on public.email_templates
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create index if not exists email_templates_agent_idx
  on public.email_templates (agent_id, sort_order);

-- --------------------------------------------------------------
-- Vault wrapper functions (only created if pgsodium/vault is available).
-- These let the service role insert/read/update/delete a secret without
-- granting direct access to the `vault` schema.
-- --------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    create or replace function public.gmail_vault_insert(p_secret text, p_name text)
    returns uuid
    language plpgsql
    security definer
    set search_path = public, vault
    as $fn$
    declare
      v_id uuid;
    begin
      select vault.create_secret(p_secret, p_name) into v_id;
      return v_id;
    end;
    $fn$;

    create or replace function public.gmail_vault_get(p_id uuid)
    returns text
    language plpgsql
    security definer
    set search_path = public, vault
    as $fn$
    declare
      v_secret text;
    begin
      select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where id = p_id;
      return v_secret;
    end;
    $fn$;

    create or replace function public.gmail_vault_update(p_id uuid, p_secret text)
    returns void
    language plpgsql
    security definer
    set search_path = public, vault
    as $fn$
    begin
      perform vault.update_secret(p_id, p_secret);
    end;
    $fn$;

    create or replace function public.gmail_vault_delete(p_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public, vault
    as $fn$
    begin
      delete from vault.secrets where id = p_id;
    end;
    $fn$;

    -- Service-role only; never expose these to anon/authenticated.
    revoke all on function public.gmail_vault_insert(text, text) from public, anon, authenticated;
    revoke all on function public.gmail_vault_get(uuid) from public, anon, authenticated;
    revoke all on function public.gmail_vault_update(uuid, text) from public, anon, authenticated;
    revoke all on function public.gmail_vault_delete(uuid) from public, anon, authenticated;
    grant execute on function public.gmail_vault_insert(text, text) to service_role;
    grant execute on function public.gmail_vault_get(uuid) to service_role;
    grant execute on function public.gmail_vault_update(uuid, text) to service_role;
    grant execute on function public.gmail_vault_delete(uuid) to service_role;
  end if;
end;
$$;
