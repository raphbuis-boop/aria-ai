# Aria — Launch-Ready MVP & Roadmap

_2026-10-22 · Builds on [ARIA_AUDIT.md](ARIA_AUDIT.md) (finding IDs like S1, C4, L1 refer to it) and [ARIA_PRODUCT_STRATEGY.md](ARIA_PRODUCT_STRATEGY.md)._

**Planning assumptions:** 2 full-stack engineers, a part-time designer, the founder as PM/QA lead. Complexity: **S** ≤ 3 engineer-days · **M** 1–2 engineer-weeks · **L** 3–4 engineer-weeks. Pilot = one New Jersey brokerage office, 5–15 agents, 60 days.

---

## 1. The pilot MVP in one paragraph

Every lead an agent receives — Zillow, Realtor.com, Homes.com, the brokerage website, or typed in — becomes an Aria client within a minute, the agent's phone buzzes, one tap opens a reply drafted in their voice, and Aria keeps the follow-up going until the lead answers. Each morning Today tells the agent who to contact and why. No buyer tours without a signed, versioned, brokerage-approved BBA. Deals under contract are tracked against NJ deadlines. The broker sees, on a desktop page, every new lead, how fast it was answered, who's falling behind, and BBA coverage. All data belongs to the brokerage, isolated from every other brokerage.

**Out of scope for the pilot:** autonomous AI texting of leads (keep `ARIA_SMS_ENABLED` off), live MLS search, client portal, listing marketing, transaction forms, Android.

---

## 2. Feature tiers

### Essential before launch
- Reproducible schema, staging environment, CI (P1)
- Confirmed bug fixes: timezone, digest pagination, reminder labels, consent default, notification routing, email escaping, BBA overwrite, automation fan-out kill switch (P2)
- Brokerage memberships + roles, brokerage-owned records, per-brokerage lead routing and integration config (P3 core)
- Lead capture by email address + parsers for Zillow/Realtor.com/Homes.com/website forms; native push + email alert; one-tap first reply; response timer (P4 core)
- Server-side follow-up cadence for new leads that stops on reply (P5 core)
- BBA: brokerage template required, brokerage named as party, negotiability + e-sign consent, versioned records, copies emailed (P6)
- Direct-to-storage uploads; Transactions reachable from client and Today (P7 core)
- Minimal broker board on desktop (P8 core)
- Next.js 16, critical dependency fixes, rate limiting, Google token encryption (P9 core)
- Smoke tests for the lead → reply → BBA journey; error alerting on the lead pipeline (P10 core)
- Non-engineering: privacy policy + data processing terms for brokerages, pilot support channel, import assistance

### Important immediately after launch
- Gmail 90-day **missed-lead scan** in onboarding (best sales demo — pull forward if capacity allows)
- Reactivation: client segments + weekly "10 people to call" batches (P5 part 2)
- NJ deal timeline template + deadline reminders + document checklist (P7 part 2)
- SLA breach → nudge → reassign (P4/P3 part 2)
- Unified "Needs you" inbox (merge Follow-ups, Emails, Inquiries, bell, "Aria needs you")
- Desktop layout for agents
- Google OAuth verification + CASA assessment; apply to Zillow App Integrations partner list
- Aria SMS for leads with recorded opt-in, quiet hours and registered per-brokerage numbers
- Fuller broker reporting (per-agent funnels, GCI forecast, exports)

### Long-term vision
- Autonomous AI qualification (ISA) across SMS and email, agent-approved playbooks
- Showing coordination (ShowingTime-style), client collections/portal
- Transaction forms integration (NJ Realtors forms via zipForm/Dotloop/SkySlope), commission and compliance review queue for brokers
- Seller-lead prediction using public-records/equity data
- Two-way sync with Follow Up Boss and other CRMs
- Additional NJ MLSs (GSMLS, Monmouth-Ocean, Bright for South Jersey) and other states (state-specific BBAs/forms)
- Call recording/summaries, Android

---

## 3. Top 10 priorities

Listed in **recommended implementation order**. "Impact" is the business-impact rank (1 = highest).

---

### P1 — Reproducible database, staging, and CI
**Impact rank:** 7 (foundation — everything else depends on it)

- **Problem:** The repo can't build a database: 3 of 24 migrations fail on a fresh Postgres, and code depends on `market_data`, `clients.portal_token` and a `files` bucket no migration creates (D1, D2). Production was partly built by hand (D3, D4). There is no CI.
- **Business value:** A brokerage pilot needs a staging environment and confidence that policy changes (P3) do what we think. Without it every security claim is unverified.
- **Status:** Baseline migration exists; ordering bugs; no CI; empty Supabase project "aria mvp test" available.
- **Solution:** Dump production schema (`supabase db dump --schema-only`), diff against repo, commit a corrected baseline. Move `supabase/waitlist.sql` into a migration; move the `brokerage_id` column add above its policy; decide portal/`market_data`/listing suite (recommend: delete the dead features). Use "aria mvp test" as staging. GitHub Actions: install, `tsc`, lint, build (≥ 6 GB heap), replay migrations against `supabase start` or plain Postgres with stubs.
- **Complexity:** S–M
- **Dependencies:** Read-only access to production DB.
- **Acceptance criteria:**
  - `supabase db reset` on an empty project applies all migrations with 0 errors.
  - Schema diff between staging and production is empty (or documented).
  - CI runs on every PR and blocks merge on typecheck/lint/build/migration failure.
  - No code references a table/column/bucket missing from migrations (script from the audit runs in CI).

---

### P2 — Confirmed bug & compliance sweep
**Impact rank:** 6

- **Problem:** Verified defects agents will hit or that create legal exposure: UTC day boundaries on Today and in crons (C1), wrong "today/tomorrow" reminder labels (C2), daily digest stops at 50 users (C3), browser-triggered automation fan-out (C4 — kill switch here, rebuild in P5), "Start Aria" always 409 (C5), lead notifications open `/inquiries` (C6), partner leads texted unless they say no (L2), unescaped HTML in emails (S4), BBA re-sign overwrites the prior signed agreement (D5), account deletion orphans files (S7).
- **Business value:** Trust. An agent who sees tomorrow's showings tonight, or a broker whose buyer's old BBA vanished, churns.
- **Status:** All located with file:line in the audit.
- **Solution:** Add `agent_profiles.timezone` (default `America/New_York`) and a `dayBounds(tz)` helper used by Today, Follow-ups and crons; paginate `listUsers` or drive from `agent_profiles`; label reminders by local date; remove `<AutomationRunner />` from `AppShell` until P5; give "start" its own send path; route lead notifications to `/clients/{id}`; `autoText` only when `smsConsent === true`; escape email template values; insert a new BBA row per signature and keep old PDFs; reuse `wipeAgentData` file cleanup on account deletion.
- **Complexity:** M (many small fixes)
- **Dependencies:** P1 CI (to land safely).
- **Acceptance criteria:**
  - At 9:30 pm ET, Today lists today's 8:30 pm showing and not tomorrow's 9 am one (unit test with fixed clock).
  - Digest job processes 120 seeded agents.
  - A partner lead without `smsConsent` is created but not texted.
  - Signing a second BBA leaves the first row and PDF intact and marks it superseded.
  - Opening the app no longer calls `/api/automation/run`.

---

### P3 — Brokerage tenancy: memberships, roles, brokerage-owned data
**Impact rank:** 3 (you can't sell to a brokerage without it)

- **Problem:** Single-agent data model; brokerage membership is self-asserted and exploitable (S1, proven); integrations are global env vars (R2); inbound SMS can match across agents (S6); agents can delete records the brokerage must retain (L4).
- **Business value:** Unlocks the brokerage sale, broker reporting (P8), lead routing (P4) and compliance.
- **Status:** `brokerages` table + per-agent auto-created brokerage; no roles; owner-only RLS everywhere (good base).
- **Solution:** Tables `brokerage_members(role: owner|admin|agent)`, `brokerage_invites`, `brokerage_integrations`, `lead_routing_rules`, `audit_events`. Add `brokerage_id NOT NULL` + `visibility` to clients and child tables (backfill from the agent's current brokerage). `security definer` helpers `is_member()`, `is_brokerage_admin()`. Rewrite RLS: own rows OR brokerage-shared rows for members OR all rows for admins. Revoke `UPDATE(brokerage_id)` from `authenticated`. Invite flow (email link). Offboarding = reassign, not delete; "Clear all data"/"Delete account" restricted for brokerage members. Replace `LEAD_DEFAULT_AGENT_ID`/global Twilio/IDX owner with per-brokerage config.
- **Complexity:** L
- **Dependencies:** P1 (staging + policy tests).
- **Acceptance criteria:**
  - RLS test suite: agent in brokerage A cannot read/update/delete any row of brokerage B (all tables, all verbs), including after attempting to change their own `brokerage_id`.
  - Admin of A can read all A clients; agent of A sees only own + shared.
  - Removing an agent reassigns their clients to a chosen member; no rows deleted.
  - Every create/delete/export of client data writes an `audit_events` row.

---

### P4 — Lead capture & instant response (the money feature)
**Impact rank:** 1

- **Problem:** Leads that arrive by email (how Zillow/Realtor.com reach non-partner CRMs) never reach Aria; the Gmail triage likely hides them as bulk; agents get no real-time alert (R1); there is no response-time measurement.
- **Business value:** Directly converts the brokerage's paid leads; the pilot's headline metric. Industry secret-shopper data shows roughly 40–47% of online inquiries get no human response (see strategy §2).
- **Status:** `ingestLead()` and the provider parsers exist and are reusable; Zillow webhook path unusable; Today has a "New leads" section with Realtime updates.
- **Solution:**
  1. Inbound email: per-agent address (e.g. `{slug}@leads.getariaai.com`) via an inbound-mail provider webhook → store raw email → source-specific parsers (Zillow, Realtor.com, Homes.com, Redfin partner, brokerage site) with an LLM fallback extractor that returns structured JSON → `ingestLead()` → dedupe.
  2. Alerts within 60 s: native push via Capacitor Push Notifications (APNs) + email via Resend; deep link to the lead.
  3. "Reply now" drafts a first message in the agent's voice referencing the property; sending opens Messages (no A2P needed); records `first_response_at`.
  4. Response clock on every lead; Today pins unanswered leads at the top with elapsed time.
  5. Update `lib/inbox/triage.ts` so portal lead emails are never "bulk".
  6. Parallel (non-eng): apply for Zillow App Integrations partner status.
- **Complexity:** L
- **Dependencies:** P2 (consent fix). Per-agent lead addresses route directly to one agent, so this starts in parallel with P3; brokerage-level routing rules plug in when P3 lands.
- **Acceptance criteria:**
  - Fixture tests: ≥ 5 real redacted emails per supported source parse name, phone/email, property and message correctly; unknown formats produce an "unparsed lead" card, never a silent drop.
  - From email received to push delivered: p95 < 60 s on staging.
  - Duplicate delivery of the same email creates one client and one alert.
  - `first_response_at` and response minutes appear on the lead and on the broker board.

---

### P5 — Server-side follow-up engine (+ reactivation)
**Impact rank:** 2

- **Problem:** Follow-up automation runs from the browser on app load, ignores client stage, generates hidden drafts and floods tasks (C4).
- **Business value:** Consistent follow-up is the second-biggest conversion lever after first response; reactivating sphere/past clients is the cheapest revenue in the book.
- **Status:** Today/Follow-ups ranking (`lib/today-items.ts`) and voice-matched drafting are strong; the automation layer is the weak part.
- **Solution:** Hourly Vercel cron (Pro plan) evaluates cadence rules per client stage: new lead (day 0/1/3/7/14/30), active buyer (no contact in N days), sphere/past client (anniversaries, birthdays, quarterly check-in). Stop on inbound reply, status change, or opt-out. Generate drafts lazily when the agent opens the item (no hidden drafts), batch-capped per agent per day. Reactivation: saved segments on Clients + "this week's 10" suggestion with a reason per person. Drop the auto-created "5-day check-in"/"Archive" tasks.
- **Complexity:** M
- **Dependencies:** P2 (timezone), P4 (lead stage + reply detection).
- **Acceptance criteria:**
  - Importing 500 contacts creates 0 drafts and 0 tasks immediately; Today shows at most 10 reactivation suggestions per day.
  - A lead who replies is removed from the cadence within one cron cycle.
  - No Claude call happens without an agent action or an explicit cron batch with a per-agent cap.

---

### P6 — BBA compliance hardening
**Impact rank:** 5

- **Problem:** Generic fallback agreement names the agent, not the brokerage, and lacks the negotiability statement and e-sign consent (L1); signed records can be overwritten (D5); no BBA check before a showing; no copy delivered to the buyer; signature stamped at a fixed spot.
- **Business value:** Brokers carry the liability; a defensible BBA flow is a reason to buy, and a broken one is a reason to refuse the pilot.
- **Status:** Link mechanics (agent-set terms, single-use, expiring, atomic claim) are solid.
- **Solution:** Brokerage must upload an approved template before links can be issued (remove the generic fallback, or keep it only as a broker-approved Aria template reviewed by NJ counsel). Show the brokerage name as party. Add ESIGN consent checkbox and required disclosures. Store executed PDF + SHA-256 + IP/UA/timestamp; insert-only versions; email executed copy to buyer and agent. Showing creation for a buyer without a current BBA prompts "Send BBA first". Optional: map signature fields (PDF form fields) instead of bottom-right stamping.
- **Complexity:** M
- **Dependencies:** P3 (brokerage settings/templates), P2 (versioning fix).
- **Acceptance criteria:**
  - Cannot issue a signing link when the brokerage has no approved template.
  - Executed PDF hash on record matches the stored file; prior versions remain downloadable.
  - Buyer receives the executed PDF by email within 1 minute of signing.
  - Scheduling a showing for a buyer without a current BBA shows the prompt.
  - NJ counsel sign-off recorded.

---

### P7 — Deals & documents that work
**Impact rank:** 8

- **Problem:** Uploads above 4.5 MB fail on Vercel (R3); Transactions is unreachable (C7); no NJ milestones (attorney review), deadline reminders, or checklist.
- **Business value:** Protects closings (where the commission is) and removes a daily annoyance with large inspection reports.
- **Status:** Documents storage is secure; transaction tracker has the right fields.
- **Solution:** Supabase signed upload URLs (browser → storage directly; server validates and records metadata). Link deals from client detail, Clients and Today. NJ timeline template applied on "Under contract" (attorney review 3 business days, inspection, mortgage commitment, appraisal, walk-through, closing) with reminders on Today and email. Per-deal document checklist mapped to `client_documents.category`.
- **Complexity:** M
- **Dependencies:** P2 (timezone), P3 (brokerage ownership).
- **Acceptance criteria:**
  - 25 MB PDF uploads succeed on production.
  - From any client with a deal, the deal is one tap away.
  - Deadlines appear on Today 2 business days before due.

---

### P8 — Minimal broker board (desktop)
**Impact rank:** 4 (it's what the broker sees and pays for)

- **Problem:** Brokers have no visibility; the UI is phone-only.
- **Business value:** The buyer of the pilot is the broker. Response-time accountability is the most-asked broker metric.
- **Status:** Nothing exists.
- **Solution:** `/brokerage` desktop page for admins: new leads (7/30 days) by source and agent; median and p90 first-response time; leads with no response; buyers with showings and no BBA; deals closing in 30 days with projected GCI; agent activity (last active, follow-ups sent). Read through RPCs/views that respect P3 policies. CSV export.
- **Complexity:** M
- **Dependencies:** P3, P4 (response times), P6 (BBA status).
- **Acceptance criteria:**
  - An admin sees all metrics for their brokerage only; an agent gets 403.
  - Numbers reconcile with raw rows in a staging test fixture.
  - Page usable at 1280 px and on a tablet.

---

### P9 — Platform security baseline
**Impact rank:** 9

- **Problem:** Next.js 14 EOL with unpatched App Router advisories (S2); 49 production vulns (5 critical); unauthenticated Claude endpoint and no rate limits (S3); plaintext Google tokens (S5); Capacitor critical advisory (L7).
- **Business value:** Brokerage IT/security questionnaires; avoiding an incident during the pilot.
- **Status:** Good auth hygiene otherwise (see audit "Done well").
- **Solution:** Upgrade to Next 16 (async request APIs codemod, test every route), `npm audit fix`, bump `@sentry/nextjs` and Capacitor; add `global-error.tsx`. Rate-limit public routes and AI routes per user/IP. Encrypt Google tokens (Supabase Vault or envelope encryption). Security headers (CSP report-only first). Confirm Vercel Pro plan.
- **Complexity:** M
- **Dependencies:** P1 (CI to catch regressions). Scheduled after P4 starts so the money feature isn't blocked; must land before pilot launch.
- **Acceptance criteria:**
  - `npm audit --omit=dev` shows 0 critical, 0 high in direct dependencies.
  - Public AI/lead routes return 429 past the configured rate.
  - Google tokens unreadable in a raw DB dump.

---

### P10 — QA & observability foundation
**Impact rank:** 10 (continuous; starts week 1)

- **Problem:** No tests; silent AI fallbacks; no pipeline monitoring.
- **Business value:** Lets two engineers move fast without breaking the lead pipeline mid-pilot.
- **Status:** Pure-function libraries (parsers, matching, today-items, triage, bba) are already easy to test.
- **Solution:** Vitest for pure logic; pgTAP/SQL RLS tests; Playwright smoke for the core journey on staging; structured logs for every Claude call (model, tokens, latency, fallback reason) and every lead (received → parsed → alerted → first response); alerts on parse failures, push failures, fallback-rate spikes.
- **Complexity:** M (spread across phases)
- **Dependencies:** P1.
- **Acceptance criteria:**
  - CI runs unit + RLS + smoke tests; coverage on `lib/sms/lead-sources.ts`, `lib/today-items.ts`, `lib/inbox/triage.ts`, `lib/bba.ts` ≥ 80%.
  - A failed lead parse pages someone within 5 minutes.

---

## 4. Sequencing

| Week | Engineer A | Engineer B | Design / PM |
|---|---|---|---|
| 1 | P1 schema + CI (ENG-01) | P2 bug sweep (ENG-02) | Pilot partner discovery; collect real lead emails |
| 2–3 | P3 membership lockdown + RLS + tests (ENG-03) | P4 inbound email + parsers (ENG-04) | Lead alert + broker board designs |
| 4 | P3 invites, offboarding, routing config | P4 push/email alerts + response clock (ENG-05) | BBA content with NJ counsel |
| 5–6 | P9 Next 16 + deps + rate limits + token encryption | P5 server-side cadences | Usability test with 3 agents |
| 7 | P6 BBA hardening | P7 direct uploads + deals reachable | Pilot onboarding kit |
| 8 | P8 broker board | P10 smoke tests + pipeline alerting | Broker walkthrough |
| 9 | Staging dry run with pilot data, bug bash | Bug bash | Go/no-go |
| 10 | **Pilot launch** | | |

P9 runs in parallel with P5. P10 (tests) and observability land with each feature, not at the end. ENG-xx IDs refer to [ARIA_AGENT_TASKS.md](ARIA_AGENT_TASKS.md).

---

## 5. Explicitly not doing before the pilot

- Turning on autonomous Aria SMS (needs A2P 10DLC, consent records, quiet hours — see audit L2/L3).
- Client portal, listing marketing suite, CMA, market insights — delete or hide dead code.
- Live MLS search as a selling point (keep the graceful no-feed mode).
- New AI features in Ask Aria.
