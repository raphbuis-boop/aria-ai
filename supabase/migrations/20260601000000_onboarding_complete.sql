-- Add onboarding_complete flag to agent_profiles.
-- New users start at false and see the wizard once.
-- Existing users are backfilled to true so they skip it.

alter table public.agent_profiles
  add column if not exists onboarding_complete boolean not null default false;

-- Backfill: all existing agents have already onboarded
update public.agent_profiles
  set onboarding_complete = true
  where onboarding_complete = false;
