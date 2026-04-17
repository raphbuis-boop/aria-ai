alter table public.showings add column if not exists status text not null default 'scheduled';
alter table public.showings add column if not exists notes text;

comment on column public.showings.status is 'scheduled | completed | cancelled';

alter table public.clients add column if not exists client_role text default 'buyer';
