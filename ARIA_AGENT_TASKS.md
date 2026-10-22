# Aria — Agent Task Assignments

_2026-10-22 · Each task is written to be picked up by an autonomous agent or a person without further context. Finding IDs (S1, C4, L1…) point to [ARIA_AUDIT.md](ARIA_AUDIT.md); P-numbers point to [ARIA_MVP_ROADMAP.md](ARIA_MVP_ROADMAP.md)._

## Ground rules for every agent

1. **Never write to production.** Use the staging Supabase project (currently "aria mvp test", empty) or a local `supabase start`. Read-only production access only for schema dumps, and only when the founder provides it.
2. **Never set `ARIA_SMS_ENABLED=1`** or send real texts/emails to non-team numbers. Use `SMS_DRY_RUN=1` and test inboxes.
3. Every new table gets RLS + policies in the same migration; every protected API route calls `getRouteSupabase()` first; phones go through `formatPhoneE164()`; UI uses semantic Tailwind tokens (see `CLAUDE.md`).
4. One branch + PR per task. CI (once ENG-01 lands) must be green. Include tests for the behavior you change.
5. If a task says "decide", write the decision and reasoning in the PR description; don't stall.
6. Report what you could not verify. Don't claim an integration works without a recorded run.

---

## First five engineering tasks (execute in this order)

### ENG-01 — Make the database reproducible; add CI
- **Roadmap:** P1 · **Fixes:** D1, D2, D4 · **Est:** S–M · **Owner:** Engineering
- **Why:** 3 of 24 migrations fail on a fresh database; code depends on objects no migration creates. Nothing else can be verified until this is fixed.
- **Steps:**
  1. With founder-provided read-only credentials, run `supabase db dump --schema-only` against production and `select * from supabase_migrations.schema_migrations` to see what's recorded as applied. Commit the dump to `supabase/prod-schema-snapshot.sql` (no data).
  2. Replay migrations on an empty Postgres (method: stub `auth.users`, `auth.uid()`, `storage.buckets`, roles `anon/authenticated/service_role`, then apply `supabase/migrations/*` in order — the audit did exactly this). Diff the result against the snapshot.
  3. Fix ordering without changing behavior on already-migrated databases (all statements are `if not exists`, so edits are safe):
     - `20260327120000_waitlist_referrals.sql`: create `public.waitlist` (from `supabase/waitlist.sql`) at the top; delete `supabase/waitlist.sql`.
     - `20260420120000_brokerages_and_matching.sql`: move the `agent_profiles.brokerage_id` column add above the `brokerages_member_select` policy.
  4. Missing objects (D2) — decide per item: `market_data` (create table or remove the reads in `app/(dashboard)/properties/[id]/page.tsx` and portal), `clients.portal_token` and `app/portal/*` (recommend delete — see PRD-09), `files` bucket and `app/(dashboard)/listings/new` (recommend delete).
  5. Resolve D3: confirm whether production has a check constraint on `clients.source`; make the repo match production; if the constraint exists, either widen it or stop imports writing `csv_import`/`sphere`/`google_contacts`/`past_client`.
  6. Add `.github/workflows/ci.yml`: `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run build` (`NODE_OPTIONS=--max-old-space-size=6144`, dummy public env) → migration replay on a Postgres service container → schema-reference check (every `.from().select()` column exists).
- **Done when:** fresh replay = 0 errors; staging matches the production snapshot (or differences documented); CI blocks merges on failure.
- **Out of scope:** changing RLS semantics (ENG-03).

### ENG-02 — Confirmed bug & compliance sweep
- **Roadmap:** P2 · **Fixes:** C1–C6, C8, D5, S4, S7, L2 · **Est:** M · **Owner:** Engineering
- **Checklist (each item gets a test where feasible):**
  - [ ] **Timezone (C1):** add `agent_profiles.timezone text not null default 'America/New_York'`; add `lib/time.ts` `dayBounds(tz, now)`; use it in `app/(dashboard)/dashboard/page.tsx:28-31`, `app/(dashboard)/inbox/page.tsx`, `lib/today-items.ts` callers, and `app/api/notifications/trigger/route.ts:285`.
  - [ ] **Reminder labels (C2):** label "today/tomorrow" by local calendar date, not `hoursAway <= 12`.
  - [ ] **Digest pagination (C3):** iterate `agent_profiles` (or page `listUsers`); replace per-client queries with one set-based query per agent.
  - [ ] **Automation kill switch (C4):** remove `<AutomationRunner />` from `components/AppShell.tsx`; leave `/api/automation/run` returning 410 until ENG-07 replaces it; delete unused `/api/inbox/backfill`.
  - [ ] **"Start Aria" (C5):** in `app/api/clients/[id]/aria/route.ts:48`, draft the first touch and call `sendClientSms` directly instead of `ingestLead(source:"manual")`.
  - [ ] **Lead notification routing (C6):** `components/NotificationPanel.tsx:30` → `/clients/{related_client_id}` when present, `/inquiries` only for IDX inquiries.
  - [ ] **Consent default (L2):** `app/api/leads/route.ts:81` → partner leads text only when `body.smsConsent === true`; store `{ consent_source, consent_text, consent_at }` on the intake activity metadata.
  - [ ] **Email escaping (S4):** escape every interpolated value in `lib/resend.ts`.
  - [ ] **BBA versioning (D5):** drop `bba_client_unique`; insert a new `buyer_broker_agreements` row per signature with `superseded_at` on the previous; unique storage path per signature (no `upsert:true`); update readers to "latest by `signed_at`".
  - [ ] **Signed URL column (C8):** stop persisting 7-day URLs in `signed_file_url`; sign on read.
  - [ ] **Account deletion files (S7):** remove the agent's storage objects on `DELETE /api/account` (reuse `wipeAgentData`'s file collection).
- **Done when:** all boxes checked, tests added for C1/C2/C3/L2/D5, nothing else changed.

### ENG-03 — Lock down brokerage membership; introduce roles
- **Roadmap:** P3 (phase 1) · **Fixes:** S1 · **Est:** M · **Owner:** Engineering
- **Why:** Proven on the repo schema: an agent can set `agent_profiles.brokerage_id` to another brokerage and read/delete its templates.
- **Steps:**
  1. **Check production for prior abuse first:** list `agent_profiles` rows whose `brokerage_id` points at a brokerage they don't own (`brokerages.owner_agent_id <> agent_profiles.id`). Report results to the founder before changing anything.
  2. Migration: `brokerage_members(brokerage_id, user_id, role check in ('owner','admin','agent'), status, created_at, primary key (brokerage_id, user_id))` with RLS (members read their own brokerage's roster; no client writes). Backfill owners from `brokerages.owner_agent_id`, and agents from `agent_profiles.brokerage_id` **only** where step 1 found nothing suspicious.
  3. `security definer` SQL helpers `is_member(bid uuid)`, `is_brokerage_admin(bid uuid)` (`set search_path = public`).
  4. Rewrite `brokerages_*` and `bba_tpl_member_*` policies to use the helpers. Templates: members read; admins insert/update/delete.
  5. `revoke update (brokerage_id) on public.agent_profiles from authenticated;` (or a `before update` trigger rejecting changes by non-service roles). Keep `agent_profiles.brokerage_id` only as a denormalized "current brokerage" written by server code.
  6. Update `lib/brokerages.ts` `ensureBrokerage` to also insert the owner membership.
  7. RLS tests (SQL/pgTAP) for: self-join attempt, cross-brokerage read/update/delete on every table, admin vs agent template writes.
- **Done when:** the audit's attack probe fails on staging; all existing flows (BBA templates in Settings, signing links) still work; tests in CI.
- **Next (separate PR, same owner):** `brokerage_id` + `visibility` on clients/children, invites, offboarding-by-reassignment, per-brokerage integrations table (rest of P3).

### ENG-04 — Inbound lead email pipeline (Zillow, Realtor.com, Homes.com, website)
- **Roadmap:** P4 (part 1) · **Est:** M–L · **Owner:** Engineering + AI architect (AI-01)
- **Why:** Leads that arrive by email never reach Aria; this is the biggest revenue lever (strategy §6).
- **Prerequisite:** PRD-02 has delivered ≥ 5 redacted real emails per source into `tests/fixtures/lead-emails/<source>/`.
- **Steps:**
  1. Pick an inbound-email provider with signed webhooks (Postmark Inbound, SendGrid Inbound Parse, or Cloudflare Email Routing → Worker). Configure `leads.getariaai.com` MX on staging.
  2. Migration: `agent_profiles.lead_inbox_slug text unique` (random, not the name); `inbound_lead_emails(id, agent_id, received_at, from_addr, subject, raw_storage_path, source, parse_status, parsed jsonb, client_id, error)` with owner RLS.
  3. Route `POST /api/leads/email`: verify provider signature; resolve agent by slug; store raw email in a private bucket; enqueue parse (respond 200 fast; use `waitUntil`).
  4. `lib/leads/email/` — one pure parser per source returning `ParsedLead` (reuse the type in `lib/sms/lead-sources.ts`), plus `detectSource()` from sender/subject. Unknown/failed → AI-01's LLM extractor; still failing → `parse_status='needs_review'` and a "New lead (couldn't read details)" card linking the raw email.
  5. Call `ingestLead(admin, { agentId, source, ...parsed, providerEventId: <Message-ID>, autoText: false })`.
  6. `lib/inbox/triage.ts`: portal lead senders are never `bulkReason` (add allowlist + test).
  7. Settings → "Lead inbox": show the agent's address with copy-paste instructions for Zillow Premier Agent notification emails and Gmail forwarding.
- **Done when:** fixture tests pass for every source; same email delivered twice → one client; a malformed email produces a review card, never a silent drop; end-to-end on staging from send to client row < 30 s.
- **Out of scope:** alerts (ENG-05), Gmail historical scan (ENG-12).

### ENG-05 — Instant lead alerts + response clock
- **Roadmap:** P4 (part 2) · **Est:** M · **Owner:** Engineering + Design (DES-01)
- **Steps:**
  1. Native push: add `@capacitor/push-notifications`, APNs key, `device_tokens(user_id, token, platform, last_seen)` with owner RLS, registration on app start. Email fallback via Resend (escaped template). Both fire from `ingestLead` for non-manual sources (one helper `notifyNewLead()`).
  2. Deep link `/clients/{id}?reply=1` opens the draft sheet with a first reply referencing the property asked about.
  3. Migration: `clients.first_response_at timestamptz`. Set it on the first outbound touch (log-send, Gmail send, logged call) after `created_at`.
  4. Today: "Unanswered leads" pinned first, showing elapsed time ("12 min"), until `first_response_at` is set.
  5. Record `lead_events(lead received → parsed → alerted → first response)` timestamps for the broker board and P10 alerting.
  6. While here, fix the "logged on tap" problem in `components/DraftSheet.tsx`: when the agent returns to the app, ask "Sent?" before marking it sent.
- **Done when:** p95 lead-received → push-delivered < 60 s on staging; response minutes visible on the client and queryable for P8; push works on a physical iPhone build.

---

## Engineering backlog (after the first five)

| ID | Task | Roadmap | Est | Depends | Done when |
|---|---|---|---|---|---|
| ENG-06 | Next.js 16 upgrade + `npm audit fix` + Sentry/Capacitor bumps + `global-error.tsx`; rate limiting on public + AI routes; encrypt Google tokens (S2, S3, S5, L7) | P9 | M | ENG-01 | 0 critical/high in direct deps; 429s on abuse; tokens unreadable in a dump |
| ENG-07 | Server-side follow-up engine: hourly cron, stage-aware cadences, stop on reply, lazy drafts, per-agent caps; reactivation segments + "this week's 10" | P5 | M | ENG-02, ENG-05 | 500-contact import creates 0 drafts/tasks; reply exits cadence within 1 cycle |
| ENG-08 | BBA hardening: template required, brokerage as party, ESIGN consent, hash + versioned records, email executed copy, BBA-before-showing prompt | P6 | M | ENG-03, PRD-03 | Acceptance criteria in roadmap P6 |
| ENG-09 | Direct-to-storage signed uploads (docs + templates); link deals from client/Today/Clients; NJ deal timeline + reminders | P7 | M | ENG-02 | 25 MB upload succeeds in prod; deadlines on Today |
| ENG-10 | Broker board (desktop) via RPCs respecting RLS; CSV export | P8 | M | ENG-03, ENG-05 | Admin sees own brokerage only; numbers reconcile with fixtures |
| ENG-11 | Rest of tenancy: `brokerage_id`/`visibility` on clients + children, invites, offboarding by reassignment, `brokerage_integrations`, `lead_routing_rules`, `audit_events`; retire `LEAD_DEFAULT_AGENT_ID` and global Twilio/IDX owner; fix cross-agent SMS phone match (S6) | P3 | L | ENG-03 | Roadmap P3 criteria |
| ENG-12 | Gmail 90-day missed-lead scan in onboarding (reuses ENG-04 parsers) | P4 follow-on | M | ENG-04, PRD-05 | Shows "found N leads, M unanswered" for a test inbox |
| ENG-13 | Delete dead code: portal, `/listings/new`, `market_data` reads, `inbox/backfill`, unused seed paths in prod builds | — | S | PRD-09 | Build smaller; no dead routes |
| ENG-14 | Consolidate model config (`lib/ai.ts`), log usage/latency/fallback per call (C9, R5) | P10 | S | AI-02 | One place to change models; dashboard of fallback rate |

---

## Design tasks

| ID | Task | Deliverable | Depends |
|---|---|---|---|
| DES-01 | **New-lead alert → reply flow**: push copy, lock-screen preview (no sensitive data), deep-link landing, draft sheet with elapsed-time indicator, "Sent?" confirm | Figma flow + copy | — |
| DES-02 | **Unified "Needs you" inbox**: merge Follow-ups, Emails needing reply, Inquiries, bell items, Aria tasks into one ranked queue; update the 5-tab nav so Showings/Deals are reachable | IA + screens | DES-01 |
| DES-03 | **Broker board (desktop)**: leads by source/agent, response times, unanswered, BBA coverage, closings/GCI | Wireframes → hi-fi | PRD-01 interviews |
| DES-04 | **BBA signing v2**: brokerage branding, disclosures, ESIGN consent, executed-copy confirmation; agent-side "send BBA" from showing prompt | Screens + copy for counsel review | PRD-03 |
| DES-05 | **Desktop layout** for the agent app: max-width content, left nav ≥ 1024 px | Layout spec using existing tokens | — |
| DES-06 | **Onboarding "missed leads" step** and lead-inbox setup instructions (Zillow, Gmail forward) | Screens + help copy | ENG-04 |
| DES-07 | **NJ deal timeline** view on client and Today | Screens | ENG-09 |

---

## Product tasks

| ID | Task | Output | Due |
|---|---|---|---|
| PRD-01 | Recruit the pilot brokerage; capture baseline metrics (current response times, lead sources, volumes) and sign a pilot agreement with success criteria from strategy §9 | Signed pilot + baseline sheet | Week 1–2 |
| PRD-02 | Collect ≥ 5 real lead notification emails per source from pilot agents; redact PII; hand to ENG-04 as fixtures | `tests/fixtures/lead-emails/*` | Week 1 |
| PRD-03 | NJ counsel review: BBA template/fallback, ESIGN consent, negotiability language, record retention (N.J.A.C. 11:5-5.4 and transaction files), TCPA consent wording | Written sign-off | Week 4 |
| PRD-04 | Apply for Zillow Premier Agent App Integrations partner status; investigate Realtor.com/Homes.com delivery options | Application submitted; findings note | Week 2 |
| PRD-05 | Google OAuth: confirm publishing status (Testing vs Production), decide on verification + CASA timing; ensure pilot users fit under 100 if unverified | Decision memo | Week 2 |
| PRD-06 | Accounts & vendors: Vercel Pro, inbound-email provider, APNs, Resend domain verification; later Twilio A2P 10DLC brand/campaign | Accounts live | Week 2–4 |
| PRD-07 | Follow-up cadence content per stage (new lead, active buyer, sphere, past client) with example messages; review AI prompts for fair-housing language | Cadence spec | Week 4 |
| PRD-08 | Packaging/pricing hypothesis for post-pilot conversion | One-pager | Week 6 |
| PRD-09 | Decide dead features (portal, listing suite, market insight, CMA): recommend delete now, revisit later | Decision in ENG-13 PR | Week 1 |
| PRD-10 | Pilot playbook: onboarding script, data import help, support channel, weekly check-ins, day-45 renewal conversation | Playbook doc | Week 8 |

---

## QA tasks

| ID | Task | Done when |
|---|---|---|
| QA-01 | Test plan for journeys J1–J5 (strategy §4) including a timezone matrix (8:30 pm/11:30 pm ET, DST change days) | Plan reviewed; cases in tracker |
| QA-02 | Tenancy/RLS negative suite: two brokerages × admin/agent × every table × select/insert/update/delete, plus the `brokerage_id` self-join probe | Runs in CI; all deny cases pass |
| QA-03 | Lead parser fixtures + property tests (missing phone, international numbers, HTML-only emails, forwarded emails, duplicates) | ≥ 95% fixture pass; failures produce review cards |
| QA-04 | Playwright smoke on staging: sign-up → onboarding → lead email arrives → push/email → reply draft → BBA link → sign → versioned record | Green in CI nightly |
| QA-05 | iOS shell exploratory test: push permission, deep links, file upload from Files/Photos, offline behavior | Bug list filed |
| QA-06 | Security regression checklist: public routes, rate limits, OAuth state, signed URL expiry, upload size/type, HTML escaping in emails | Checklist passes before go/no-go |
| QA-07 | Scale test: import 2,500 contacts; confirm no fan-out, no 1,000-row truncation, Today renders < 2 s | Numbers recorded |
| QA-08 | Go/no-go checklist for pilot launch (all Essential items in roadmap §2 verified on staging with pilot data) | Signed off by founder |

---

## AI automation architect tasks

| ID | Task | Done when |
|---|---|---|
| AI-01 | Lead-email extractor: deterministic parsers first; LLM fallback using structured outputs (`output_config.format` JSON schema) returning `ParsedLead` + confidence; low confidence → human review; never invents a phone/email | ≥ 95% field accuracy on fixtures; 0 fabricated contact fields |
| AI-02 | Model consolidation & cost: single model config; evaluate `claude-opus-5-5` vs `claude-sonnet-5-5` per route (first-touch drafts, inbox replies, extraction) on an eval set; set effort per route; log tokens/latency/fallbacks | Decision table + config PR (ENG-14) |
| AI-03 | Draft-quality eval: 50 real anonymized scenarios (new lead, stale buyer, past client, post-showing); score "sendable without edits"; track drafts-sent ÷ drafts-generated in the pilot | Baseline score + weekly metric |
| AI-04 | Guardrails for future autonomous texting: explicit consent check, quiet hours (8 am–9 pm recipient local), lower daily cap (current 25/client/day in `lib/sms/inbound.ts:21` is high), handoff triggers, fair-housing rules in the system prompt (no steering by protected class), audit log of every AI-sent message | Spec + tests; gate for any `ARIA_SMS_ENABLED` rollout |
