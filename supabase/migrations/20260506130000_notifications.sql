create table if not exists public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in (
                       'showing_reminder',
                       'engagement_alert',
                       'task_due',
                       'inquiry_received',
                       'match_found'
                     )),
  title              text not null,
  body               text,
  related_client_id  uuid references public.clients(id) on delete set null,
  related_listing_id text,
  read               boolean not null default false,
  dedup_key          text,
  created_at         timestamptz not null default now()
);

-- Prevent duplicate notifications for the same event
create unique index if not exists notifications_dedup_idx
  on public.notifications (agent_id, dedup_key)
  where dedup_key is not null;

create index if not exists notifications_agent_unread_idx
  on public.notifications (agent_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy "agent_all_notifications"
  on public.notifications for all
  using  (agent_id = auth.uid())
  with check (agent_id = auth.uid());
