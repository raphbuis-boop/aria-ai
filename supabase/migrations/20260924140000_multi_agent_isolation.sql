-- Multi-agent isolation for the second real user.

-- 1. IDX listing inquiries were readable/editable by every signed-in user.
--    Rows now belong to one agent; rows saved before inquiries carried an
--    agent go to the original (first) account, which owned the IDX site.
update public.idx_listing_inquiries
set agent_id = (select id from auth.users order by created_at asc limit 1)
where agent_id is null;

drop policy if exists auth_select_inquiries on public.idx_listing_inquiries;
drop policy if exists auth_update_inquiries on public.idx_listing_inquiries;
drop policy if exists auth_delete_inquiries on public.idx_listing_inquiries;
drop policy if exists public_insert_inquiries on public.idx_listing_inquiries;

create policy inquiries_owner_select on public.idx_listing_inquiries
  for select using (agent_id = auth.uid());
create policy inquiries_owner_update on public.idx_listing_inquiries
  for update using (agent_id = auth.uid()) with check (agent_id = auth.uid());
create policy inquiries_owner_delete on public.idx_listing_inquiries
  for delete using (agent_id = auth.uid());
-- Inserts come only from the server (service role) via /api/listing-inquiries.

-- 2. Google OAuth tokens never leave the server. Browsers may see which
--    account is connected (and disconnect it), not the tokens.
revoke all on public.gmail_integrations from anon, authenticated;
grant select (agent_id, email, scope, connected_at, updated_at) on public.gmail_integrations to authenticated;
grant delete on public.gmail_integrations to authenticated;
