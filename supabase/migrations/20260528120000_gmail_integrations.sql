create table if not exists gmail_integrations (
  agent_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table gmail_integrations enable row level security;

create policy "agents manage own gmail integration"
  on gmail_integrations for all
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);
