-- =============================================================================
-- Add per-agent licensed identity columns to agent_profiles.
-- Required for NJMLS Section 13.1 compliance when multiple agents from
-- different brokerages share the same Aria platform.
--
-- Usage (Phase 2): populate these columns in the agent onboarding flow and
-- pass the agent profile to getIdxDisclaimerForAgent() (lib/compliance.ts)
-- when rendering public listing pages tied to a specific agent's link.
-- The generic /property-search page continues to use the DEFAULT_* fallbacks
-- from lib/compliance.ts until per-agent public URLs are implemented.
-- =============================================================================

alter table public.agent_profiles
  add column if not exists agent_full_name   text,
  add column if not exists agent_license     text,
  add column if not exists brokerage_name    text,
  add column if not exists brokerage_license text,
  add column if not exists brokerage_address text,
  add column if not exists brokerage_phone   text;
