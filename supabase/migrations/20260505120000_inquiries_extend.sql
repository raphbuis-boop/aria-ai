-- Extend idx_listing_inquiries with CRM-grade columns for the inquiries dashboard.
alter table public.idx_listing_inquiries
  add column if not exists status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'archived')),
  add column if not exists source text not null default 'property_search',
  add column if not exists listing_price integer,
  add column if not exists agent_id uuid references auth.users (id),
  add column if not exists converted_client_id uuid references public.clients (id);

-- RLS policies (RLS was already enabled; no policies were previously defined).

-- Anyone (including unauthenticated visitors) can submit an inquiry via the public form.
create policy "public_insert_inquiries"
  on public.idx_listing_inquiries
  for insert
  to anon, authenticated
  with check (true);

-- Authenticated agents can read all inquiries.
create policy "auth_select_inquiries"
  on public.idx_listing_inquiries
  for select
  to authenticated
  using (true);

-- Authenticated agents can update (e.g. change status).
create policy "auth_update_inquiries"
  on public.idx_listing_inquiries
  for update
  to authenticated
  using (true)
  with check (true);

-- Authenticated agents can delete inquiries.
create policy "auth_delete_inquiries"
  on public.idx_listing_inquiries
  for delete
  to authenticated
  using (true);
