-- Tasks table for client next-action tracking
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  agent_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  due_at      timestamptz,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_client_id_idx on public.tasks(client_id);
create index if not exists tasks_agent_id_idx  on public.tasks(agent_id);

alter table public.tasks enable row level security;

-- Agent can do anything to their own tasks
create policy "agent_all_tasks"
  on public.tasks for all
  using  (agent_id = auth.uid())
  with check (agent_id = auth.uid());
