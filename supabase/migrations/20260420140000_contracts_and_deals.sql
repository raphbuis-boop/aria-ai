-- ============================================================================
-- Per-client contracts/documents and deal history.
--
-- client_documents: agent-uploaded files (PDFs, images, docs) scoped to a
--                   specific client. Categories map to real-estate workflow.
--                   Files live in the `client-documents` Supabase storage
--                   bucket. This table stores metadata only (path + size).
--
-- client_deals:     chronological record of every contract/deal the agent
--                   has worked on for a given client — whether the deal
--                   closed, fell through, or is still in motion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. client_documents
-- ---------------------------------------------------------------------------
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null check (category in (
    'purchase_offer',
    'counter_offer',
    'inspection_report',
    'disclosure',
    'appraisal',
    'mortgage_docs',
    'closing_docs',
    'bba',
    'other'
  )),
  file_name text not null,
  storage_path text not null,                    -- path inside `client-documents` bucket
  file_url text,                                 -- optional cached signed URL (short-lived)
  file_size bigint,                              -- bytes
  mime_type text,
  notes text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists client_documents_client_idx
  on public.client_documents (client_id, uploaded_at desc);
create index if not exists client_documents_agent_idx
  on public.client_documents (agent_id);

-- ---------------------------------------------------------------------------
-- 2. client_deals
-- ---------------------------------------------------------------------------
create table if not exists public.client_deals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  -- transaction_id is a soft reference to the transactions table (no FK so
  -- this migration is safe to apply even on DBs where `transactions` doesn't
  -- exist yet). The app treats a stale id as "unlinked" gracefully.
  transaction_id uuid,
  property_address text not null,
  status text not null default 'offer_made' check (status in (
    'offer_made',
    'offer_accepted',
    'under_contract',
    'closed',
    'fell_through',
    'cancelled'
  )),
  offer_amount numeric(14, 2),
  offer_date date,
  accepted_date date,
  closed_date date,
  outcome text,                                  -- short free-text outcome label
  outcome_notes text,                            -- longer narrative notes
  fell_through_reason text check (fell_through_reason in (
    'financing',
    'inspection',
    'cold_feet',
    'appraisal',
    'title',
    'other'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_deals_client_idx
  on public.client_deals (client_id, offer_date desc, created_at desc);
create index if not exists client_deals_agent_idx
  on public.client_deals (agent_id);
create index if not exists client_deals_tx_idx
  on public.client_deals (transaction_id);

-- Keep updated_at fresh.
create or replace function public.client_deals_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_deals_touch_updated_at on public.client_deals;
create trigger client_deals_touch_updated_at
  before update on public.client_deals
  for each row execute function public.client_deals_touch_updated_at();

-- ===========================================================================
-- 3. RLS + policies
-- ===========================================================================
alter table public.client_documents enable row level security;
alter table public.client_deals enable row level security;

drop policy if exists client_documents_owner_all on public.client_documents;
create policy client_documents_owner_all on public.client_documents
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists client_deals_owner_all on public.client_deals;
create policy client_deals_owner_all on public.client_deals
  for all
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- ===========================================================================
-- 4. Storage bucket for uploaded documents (private; all I/O through
--    server-side admin client in /api/client-documents routes).
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;
