-- Settings page: profile phone, notification prefs, and message-draft prefs.
-- All additive/idempotent — safe to run against a table that already has
-- some of these columns from manual/ad-hoc changes.

alter table public.agent_profiles
  add column if not exists phone text,
  add column if not exists notify_followups boolean not null default true,
  add column if not exists reminder_hour_et smallint not null default 8,
  add column if not exists draft_tone text not null default 'warm',
  add column if not exists signature text;

alter table public.agent_profiles
  drop constraint if exists agent_profiles_reminder_hour_et_check;
alter table public.agent_profiles
  add constraint agent_profiles_reminder_hour_et_check
    check (reminder_hour_et >= 0 and reminder_hour_et <= 23);

alter table public.agent_profiles
  drop constraint if exists agent_profiles_draft_tone_check;
alter table public.agent_profiles
  add constraint agent_profiles_draft_tone_check
    check (draft_tone in ('warm', 'professional', 'direct', 'casual'));
