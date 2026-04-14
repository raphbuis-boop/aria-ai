-- Run in Supabase SQL editor if agent_profiles does not yet have license_state
alter table agent_profiles add column if not exists license_state text default 'NJ';
