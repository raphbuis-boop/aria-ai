# Aria — Engineering & Feature Audit

_Audit date: 2026-10-22 · Branch audited: `claude/dazzling-ride-tc7m1t` @ `7a480d6` · Scope: whole repository (no production access)_

Companion documents: [ARIA_PRODUCT_STRATEGY.md](ARIA_PRODUCT_STRATEGY.md) · [ARIA_MVP_ROADMAP.md](ARIA_MVP_ROADMAP.md) · [ARIA_AGENT_TASKS.md](ARIA_AGENT_TASKS.md)

---

## Status update — 2026-10-22 (branch `claude/aria-engineering-fixes`)

| Finding | Status | Commit |
|---|---|---|
| S1 self-assigned brokerage membership | **Fixed** — `brokerage_members` with roles, guard trigger, rewritten policies and routes; attack replayed in `supabase/tests/brokerage_isolation.sql` | `899b6ac` |
| D1 migrations fail on a fresh DB | **Fixed** — all migrations replay; CI job runs them | `4745c12` |
| D2 objects missing from migrations | **Fixed** — `market_data`, `clients.portal_token`, `files` bucket created idempotently | `4745c12` |
| D3/D4 production schema unversioned | **Open** — needs a read-only production schema dump | — |
| D5 BBA re-sign overwrote the signed agreement | **Fixed** — insert-only versions, `record_bba_signature()`, agents can't edit signed rows | `3cbe302` |
| C1 Today used UTC days · C2 reminder labels · C3 digest stopped at 50 users | **Fixed** (`lib/time.ts`; zoned crons; paginated users; batched contact lookups) | `b355a8b` |
| C4 browser-triggered automation fan-out | **Fixed** — removed; server-side cadence engine is roadmap P5 | `ca2e8e1` |
| C5 "Start Aria" always 409 | **Fixed** | `238d2ac` |
| C6 lead notifications open `/inquiries` | **Withdrawn — not a bug.** `hrefFor` checks `related_client_id` first and lead notifications set it; the audit read only one line | — |
| C7 Transactions unreachable | **Fixed** — Deals section on client detail, links from Clients | `ad96163` |
| C8 7-day signed URL persisted | **Fixed** | `3cbe302` |
| S2 Next.js 14 EOL · dependency criticals | **Fixed** — Next 16.4 / React 19; `npm audit --omit=dev`: 0 vulnerabilities | `972ccfc`, `c37b2f4` |
| S4 HTML injection in emails | **Fixed** | `b355a8b` |
| S7 account deletion orphaned files | **Fixed** | `21d0371` |
| L2 partner leads texted without consent | **Fixed** — texting requires `smsConsent: true`; consent recorded on intake | `238d2ac` |
| Portal would show internal tasks | **Fixed** | `21d0371` |
| New: AI property search dropped every town | **Fixed** (found while adding tests) | `df8dae2` |
| S3 rate limiting · S5 token encryption · S6 cross-agent SMS match · L1 BBA legal content · L3 quiet hours | **Open** — roadmap P6/P9/ENG-11 | — |
| Tests / CI | **Added** — 47 unit tests, 2 SQL test suites, `.github/workflows/ci.yml` | `a8b78d0` + CI commit |

**Deploy order:** apply the new migrations (`20261022120000`–`20261022140000`) before deploying the code — the routes read `brokerage_members` and call `record_bba_signature()`. After applying, check `brokerage_membership_review` for agents whose profile pointed at someone else's brokerage.

---

## 0. How to read this audit

**Evidence labels** used throughout:

| Label | Meaning |
|---|---|
| **[Ran]** | Verified by executing something in this audit (build, typecheck, migration replay, RLS probe, dependency audit). |
| **[Code]** | Verified by reading the code path end to end. Not exercised against live services. |
| **[Unverified]** | Could not be confirmed — depends on production data, credentials, third-party accounts or settings outside the repo. |

**What I could not access:** the production Supabase database (the only project visible to the Supabase connector, "aria mvp test", is empty — 0 tables, 0 migrations), Vercel project settings/env vars, Twilio, SimplyRETS, Google Cloud OAuth consent status, Resend, Meta, Sentry. Every statement about those systems is about **what the code does**, not whether the integration is live.

**Assumptions:** production runs on Vercel (from `vercel.json`, `@vercel/functions`, comments); the production database was built partly by hand in the Supabase dashboard (stated in `supabase/migrations/00000000000000_baseline_schema.sql`); Aria SMS is off in production (`ARIA_SMS_ENABLED` default, commit `5657417`); the target market is New Jersey (code, compliance text, town graph).

---

## 1. Executive summary

1. **The codebase is better than a typical early-stage CRM in the places that matter for trust** — RLS on every table, careful OAuth state handling, Twilio signature checks, idempotent webhooks, single-use expiring BBA links, a hard guard against demo-seeding real accounts, and honest empty states. TypeScript is clean and lint is nearly clean. **[Ran]**
2. **It is a single-agent product wearing a brokerage label.** Every row is scoped to `agent_id = auth.uid()`. Brokerages exist only as an auto-created "{Name}'s Brokerage" row; there are no roles, no admin view, no shared records, and every inbound lead source routes to one env-configured agent (`LEAD_DEFAULT_AGENT_ID`). **[Code]**
3. **Brokerage membership is self-asserted and exploitable.** An agent can set their own `agent_profiles.brokerage_id` to any brokerage UUID and then read and delete that brokerage's BBA templates. Proven on a fresh database built from the repo's migrations. **[Ran]** (production policies [Unverified])
4. **The database cannot be rebuilt from the repo.** 3 of 24 migrations fail on a fresh Postgres; the code also depends on a table (`market_data`), a column (`clients.portal_token`) and a storage bucket (`files`) that no migration creates. Standing up staging or a second environment is currently guesswork. **[Ran]**
5. **"Zillow lead integration" does not exist in a usable form.** There is a JSON parser for "Zillow-shaped" webhooks, but Zillow delivers Premier Agent leads to CRMs only through its approved-partner App Integrations list (or email). Aria is not a partner, nothing in the repo is a Zillow sender, and the Gmail triage likely files Zillow lead emails as bulk notifications. **[Code]** + external research
6. **The agent is never alerted in real time when a lead arrives.** New leads produce only an in-app bell row. No push, no SMS-to-agent, no email. With Aria SMS off (the production default), a 9 pm Zillow lead waits until the agent next opens the app. This is the single largest revenue leak in the product. **[Code]**
7. **The automation engine runs from the browser and fans out unbounded AI calls.** Every app load POSTs `/api/automation/run`, which loops all clients serially and calls Claude for each eligible one — including freshly imported sphere contacts — and writes drafts that no screen shows. **[Code]**
8. **The BBA flow is a legal liability in its fallback form.** Without an uploaded brokerage template, the buyer signs a generic summary naming the individual agent (not the brokerage) as the party, with no "compensation is negotiable" statement and no e-sign consent. Re-signing overwrites the prior signed agreement. **[Code]**
9. **Platform risk:** Next.js 14 is end-of-life (Oct 2025) and the app uses the App Router; `npm audit` reports 49 production vulnerabilities (5 critical, 20 high). Document uploads advertise 25 MB but Vercel functions cap request bodies at 4.5 MB. **[Ran]** + external research
10. **There is no test suite, no CI, and no rate limiting.** One unauthenticated route spends Claude tokens on demand. **[Ran]/[Code]**

---

## 2. Checks run

| Check | Command / method | Result |
|---|---|---|
| Install | `npm ci` | OK **[Ran]** |
| Typecheck | `npx tsc --noEmit` | **0 errors** **[Ran]** |
| Lint | `npm run lint` | **1 warning** (`components/DraftSheet.tsx:69`, ref in effect cleanup) **[Ran]** |
| Production build | `npm run build` with dummy public env | **Passes** with `NODE_OPTIONS=--max-old-space-size=6144`; first attempt with default heap **OOM-crashed** in this container (compile step had succeeded). Watch CI runner memory. Sentry warns: no `global-error.js`, deprecated config keys. **[Ran]** |
| Dependency audit | `npm audit --omit=dev` | **49 vulns: 5 critical, 20 high, 23 moderate, 1 low.** Critical: `next` (needs 16.x), `@sentry/nextjs` (tunnel-route bypass; tunnel is disabled here), `@capacitor/ios` (remote content at app origin), `proxy-addr`, `tar` (transitive). **[Ran]** |
| Migration replay | Fresh Postgres 16 + stubbed `auth`/`storage` schemas, apply `supabase/migrations/*` in order | **3 of 24 fail** — see §5.1 **[Ran]** |
| Schema vs code | Extracted every `.from(t).select(cols)` in `app/` and `lib/`, compared to the fresh schema | All selected columns exist once migrations are patched; missing objects: `market_data`, `clients.portal_token`, `files` bucket **[Ran]** |
| RLS coverage | `pg_policy` on the fresh schema | RLS enabled on all 23 public tables; owner-scoped policies everywhere; `waitlist` has RLS with no policies (service-role only — fine) **[Ran]** |
| RLS attack probe | As agent B (role `authenticated`), self-assign broker A's `brokerage_id` | B went from seeing 0 → 1 of A's templates and **deleted it** **[Ran]** |
| Live DB / advisors | Supabase connector `list_projects`, `list_tables`, `get_advisors` | Only an empty project is visible → production schema/advisors **[Unverified]** |
| Tests | Search for test runner/config | None. `bruno/` has 4 manual API requests. **[Ran]** |
| CI | `.github/` | Does not exist **[Ran]** |

---

## 3. Architecture snapshot

- **Stack:** Next.js 14.2 App Router · TypeScript · Supabase (Postgres + Auth + Storage + Realtime) · Anthropic SDK · Tailwind · Capacitor iOS shell that loads `https://getariaai.com/crm` · Sentry · PostHog · Resend · Twilio · SimplyRETS · Google APIs (Gmail, Calendar, Contacts) · ElevenLabs TTS.
- **Size:** ~35k lines TS/TSX; 81 API route files; 24 migrations; 23 public tables.
- **Auth:** Supabase Auth; `middleware.ts` gates pages; every non-public API route calls `getRouteSupabase()` (verified by sweep of all 81 routes — exceptions are intentional public routes listed in §5.2). **[Code]**
- **Data access pattern:** user-scoped Supabase client (RLS enforced) for most reads/writes; service-role admin client in webhooks, public token flows, storage, and a handful of agent routes that check ownership manually first. **[Code]**
- **AI:** `lib/ai.ts` (`claude-sonnet-5-5`) for drafts/Q&A; `lib/sms/conversation.ts` and `lib/inbox/ai.ts` hardcode `claude-opus-5` (valid but prior-generation; `claude-opus-5-5` is newer and ~20% cheaper per token). Ask Aria is a read-only tool-calling agent with a deterministic no-AI fallback (`lib/ai/insights.ts`) — a sound design. **[Code]**
- **Scheduled work:** two Vercel crons (`vercel.json`): showing reminders at 07:00 UTC and a daily digest at 12:00 UTC. Everything else "scheduled" runs when the agent opens the app. **[Code]**
- **Mobile/desktop:** the authenticated UI is phone-first with a bottom tab bar and essentially no desktop breakpoints or max-width containers in `app/(dashboard)`. **[Code]**

---

## 4. Feature inventory — what actually works

Status key: **Working** = complete code path, no defects found · **Partial** = works with notable gaps · **Off** = behind a flag / needs credentials · **Broken** = defect prevents the stated behavior · **Dead** = unreachable or never wired · **Missing** = not built.

### 4.1 The starting assumptions, checked

| Assumed feature | Reality | Status |
|---|---|---|
| Gmail-based follow-up assistance | `/emails` reads the agent's Gmail on demand (no background sync, no push), triages "needs reply" vs bulk, drafts replies with Claude, sends in-thread via `gmail.send`. Tokens stored per agent. Uses restricted scopes → Google CASA assessment needed beyond 100 users. | **Partial** **[Code]** |
| Client profiles & contact management | Clients list with computed 0–10 lead score, detail page with preferences, homes, showings, BBA & documents, tasks, timeline. CSV + Google Contacts import with normalization and de-dupe. | **Working** (single agent) **[Code]** |
| Showing scheduling | Manual create/edit/cancel on `/showings`; SMS-requested showings land as `requested` for approve/decline (only when Aria SMS is on); optional Google Calendar event on approval (needs `GOOGLE_CALENDAR_WRITE=1` + re-consent). No showing-agent/listing-agent coordination (ShowingTime etc.). | **Partial** **[Code]** |
| Files on client profiles | Private `client-documents` bucket, ownership checks, signed URLs, category tags, timeline breadcrumb. **Uploads over 4.5 MB will fail on Vercel** although the UI allows 25 MB. | **Partial / Broken for large files** **[Code]** + Vercel docs |
| MLS search redirects | With no SimplyRETS credentials every MLS route returns `connected:false`; UI shows "Search NJMLS" link and "add a home from a pasted Zillow/Realtor.com/NJMLS link or MLS #" (scraped/parsed by `lib/property-extract.ts`). Live MLS search exists if SimplyRETS is configured. | **Working as a fallback**; live feed **[Unverified]** |
| Zillow lead integration | `POST /api/leads?source=zillow` with a shared bearer secret and a tolerant parser (`lib/sms/lead-sources.ts`). No Zillow system can call it (Zillow uses partner App Integrations or email). No sample payloads or tests. | **Dead in practice** **[Code]** |

### 4.2 Full inventory

| Area | Where | Status | Notes |
|---|---|---|---|
| Sign-up / login / Google OAuth | `app/login`, `app/signup`, `app/auth/callback` | Working | |
| Guided onboarding | `app/onboarding` | Working | name → Google → import → voice → Today |
| Today (daily plan) | `app/(dashboard)/dashboard` + `lib/today-items.ts` | Partial | Good revenue-ranked rules (closings, hot leads, BBA gaps, matches, stale, seller propensity, birthdays). **Day boundaries use server UTC** (§5.3). |
| Follow-ups queue | `app/(dashboard)/inbox` | Working | Same ranking as Today; drafts on demand; sends via `sms:` deep link + `log-send`. |
| Automation drip | `components/AutomationRunner.tsx` → `/api/automation/run` | Broken by design | Browser-triggered, unbounded, writes drafts no screen shows (§5.3). `/api/inbox/backfill` is never called. |
| Ask Aria (chat + voice) | `/voice`, `/api/ai/assistant`, `/api/tts` | Working | Read-only tools; no-AI fallback; ElevenLabs TTS needs key. |
| Lead intake API | `/api/leads`, `/api/leads/meta`, `/api/listing-inquiries` | Partial | Works, but all non-agent sources route to one global agent; consent defaults to "yes" for partners (§5.4). |
| Aria SMS (AI texting leads) | `lib/sms/*`, Twilio webhooks | Off | Thoughtful flow (dedupe, STOP/START, handoff, daily cap, showing requests). "Start Aria" on existing client is broken (§5.3). No quiet hours. Needs A2P 10DLC. |
| Property matching | `lib/matching.ts`, `lib/matchProperties.ts` | Working | Weighted fuzzy match with NJ town adjacency. Only against the agent's own `properties`. |
| Properties / add from link | `/properties`, `/api/properties/extract` | Working | Scrapes public listing pages; brittle by nature. |
| MLS search & saved listings | `/listings`, `/properties/saved`, `/api/mls/*` | Off | Needs SimplyRETS + NJMLS IDX approval. IDX notices render only when configured. |
| BBA (agent-set terms → signing link) | `/api/bba/*`, `app/bba/sign/[token]` | Partial | Strong link mechanics; weak legal content and no versioning (§5.4). |
| BBA templates (brokerage PDFs) | `/api/bba-templates` | Partial | Works per "brokerage"; membership exploitable (§5.2); signature stamped bottom-right of last page, not into fields. |
| Transactions | `/transactions` | Partial / Dead entry | Manual tracker with inspection/appraisal/commitment/closing dates. **No link to it anywhere in the app** (only reachable by URL). No NJ attorney-review milestone, no deadline reminders. |
| Deal history | `/api/client-deals` | Working | Per-client offers/outcomes. |
| Listing marketing suite | `/listings/new` | Dead | No inbound link; uploads to a `files` bucket no migration creates. |
| Client portal | `app/portal/[token]` | Dead | Nothing ever sets `clients.portal_token`; column not in migrations. If enabled it would show clients **all** of the agent's internal tasks about them. |
| Public property search (IDX) | `app/property-search` | Off | Needs MLS; uses public unauthenticated `search-parse` (Claude). |
| Inquiries | `/inquiries` | Partial | IDX form leads for the single site owner. |
| Notifications | bell + `/api/notifications/*` + crons | Partial | In-app only; daily digest email; showing reminder email. |
| Settings | `/settings` | Working | Profile, integrations status, voice training, drafts tone, data reset, account delete. |
| Brokerage admin | — | Missing | No roles, no team view, no reporting. |
| Desktop layout | — | Missing | Phone layout stretched to full width. |
| Tests / CI | — | Missing | |

---

## 5. Findings

Severity: **Critical** = data exposure, legal exposure, or blocks a pilot · **High** = wrong behavior users will hit · **Medium** = will bite at pilot scale · **Low** = hygiene.

### 5.1 Data model & environments

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| D1 | **Critical** | **Migrations don't build a database.** `20260327120000_waitlist_referrals.sql` alters `public.waitlist`, which only exists in `supabase/waitlist.sql` (outside migrations). `20260420120000_brokerages_and_matching.sql` creates a policy reading `agent_profiles.brokerage_id` *before* the same file adds that column, so the rest of the file never applies — which then breaks `20261020120000_bba_requests.sql` (FK to `brokerage_bba_templates`). | **[Ran]** fresh replay | Move `waitlist` DDL into a migration; reorder the column add above the policy; add a CI job that replays migrations on an empty Postgres. |
| D2 | High | **Objects the code uses that no migration creates:** `market_data` table (`app/(dashboard)/properties/[id]/page.tsx:78`, `app/portal/[token]/page.tsx`), `clients.portal_token` (`app/portal/[token]/page.tsx:17`, `app/api/engagement/log/route.ts:33`), `files` storage bucket (`app/(dashboard)/listings/new/page.tsx:35`). | **[Ran]** | Either create them in migrations or delete the dead features (recommended for portal/listing suite until they're designed). |
| D3 | High | **`clients.source` vocabulary contradiction.** `20260923120000_aria_core_workflow.sql:7` and `lib/sms/lead-sources.ts` say production has a check constraint limiting `source` to zillow/google/facebook/referral/other/manual, yet imports write `csv_import`, `sphere`, `google_contacts`, `past_client` (`app/api/clients/import/route.ts:31`, `app/api/contacts/google/route.ts:59`). One of the two is wrong in production. | **[Code]**, prod **[Unverified]** | Dump the production schema (`supabase db dump --schema-only`) and commit it as the true baseline. |
| D4 | High | **Production schema is partly hand-made and unversioned** (stated in the baseline migration header). Until a real schema dump is committed, every audit of RLS is an audit of what the repo *thinks* production is. | **[Code]** | Same as D3; enable Supabase branching or a staging project ("aria mvp test" is empty and could be that project). |
| D5 | Medium | **One BBA per client, overwritten on re-sign.** `bba_client_unique` (`supabase/migrations/20260418120000_buyer_broker_agreements.sql:28`) + `upsert(..., { onConflict: "client_id" })` (`app/api/bba/sign/[token]/route.ts:285`) — renewing replaces the prior signature, terms, IP/UA and (same storage key, `upsert:true`) the prior signed PDF. A signed agreement is a record you must keep. | **[Code]** | Insert a new row per signature; mark superseded ones; never overwrite PDFs. |
| D6 | Medium | **Supabase default 1,000-row cap.** Lists like clients, 30-day activities, and the daily digest's per-agent client list have no pagination. A 2,500-contact Google import would silently truncate. | **[Code]**; project `max_rows` **[Unverified]** | Paginate server queries; show counts. |
| D7 | Low | `lead_score` column exists but is deliberately unused (computed score is authoritative) — fine, but drop or document it to avoid confusion. | **[Code]** | |

### 5.2 Security

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| S1 | **Critical** (before multi-agent) | **Self-asserted brokerage membership.** `agent_profiles_self_all` (`supabase/migrations/00000000000000_baseline_schema.sql:58`) allows an agent to update any column of their own profile, including `brokerage_id`; every brokerage policy derives membership from that column (`20260420120000_brokerages_and_matching.sql`, `bba_tpl_member_*`). Probe: agent B joined broker A's brokerage and deleted A's template. Prerequisite: knowing the brokerage UUID (returned to members by `GET /api/bba-templates` and embedded in signed-PDF storage paths). | **[Ran]** on repo schema | `brokerage_members(brokerage_id, user_id, role)` written only by service role / brokerage admins; revoke `UPDATE (brokerage_id)` from `authenticated`; rewrite policies on membership. |
| S2 | High | **Next.js 14 is EOL** (Oct 26, 2025) with App Router RSC/Server-Action DoS and SSRF advisories unpatched on 14.x; audit reports critical items fixed only in 16.x. Image-optimizer RCEs are likely not reachable (no `next/image` usage) — still upgrade. | **[Ran]** + [HeroDevs](https://www.herodevs.com/blog-posts/nextjs-eol-dates-version-support-timeline), [Vercel community](https://community.vercel.com/t/is-there-a-fix-available-for-cve-2026-23864-in-nextjs-v14/32932) | Upgrade to Next 16 (async `params`/`cookies()` changes); `npm audit fix` for transitive items; bump `@capacitor/ios` and `@sentry/nextjs`. |
| S3 | High | **Unauthenticated AI endpoint.** `POST /api/ai/search-parse` (`app/api/ai/search-parse/route.ts:61`) calls Claude for anyone, no rate limit. | **[Code]** | Rate-limit by IP (e.g. Upstash/Vercel KV) or require a signed portal session. Add a global rate limiter for all public routes (`/api/leads` bearer, `/api/listing-inquiries`, `/api/waitlist`, `/api/bba/sign/*`). |
| S4 | High | **HTML injection in emails to agents.** Lead/client names go unescaped into Resend HTML (`lib/resend.ts:71`, and the showing template). Lead names come from public forms and partner payloads. | **[Code]** | Escape all interpolated values. |
| S5 | Medium | **Google OAuth tokens stored in plaintext** (`supabase/migrations/20260528120000_gmail_integrations.sql:4`). Column grants keep them from the browser (`20260924140000_multi_agent_isolation.sql`), but a DB dump or service-role leak exposes every agent's mailbox. | **[Code]** | Encrypt with Supabase Vault / pgsodium or app-level envelope encryption. |
| S6 | Medium | **Inbound SMS routing can cross agents.** When the texted number isn't an agent's own (shared env number), the sender is matched by phone across *all* agents' clients (`lib/sms/inbound.ts:69`), most-recent engagement wins. Two agents with the same buyer → texts land with the wrong agent. | **[Code]** | Per-agent or per-brokerage numbers; never match across brokerages. |
| S7 | Medium | **Account deletion orphans files.** `DELETE /api/account` (`app/api/account/route.ts:29`) cascades DB rows but never removes `client-documents` / signed BBA PDFs from storage (the "Clear all data" path does). It also cascades the agent's brokerage (`owner_agent_id ... on delete cascade`), which would wipe templates for any other members. | **[Code]** | Reuse `wipeAgentData` file removal; in a brokerage model, agent offboarding must transfer, not delete. |
| S8 | Low | Single shared `LEAD_WEBHOOK_SECRET` lets any holder file leads under any `agentId` (unvalidated; bad id → 500). Fine for one agent, wrong for brokerages. | **[Code]** | Per-brokerage lead keys. |
| S9 | Low | `app/api/mls/listings` is public by design (IDX). Watch SimplyRETS quota once live. | **[Code]** | Cache + rate-limit. |

**Done well (keep):** Google OAuth nonce bound to cookie *and* signed-in user (`app/api/auth/google/connect/route.ts`); Twilio signature verification incl. proxy host reconstruction (`lib/twilio.ts`); Meta HMAC and timing-safe bearer compare (`lib/sms/lead-auth.ts`); BBA tokens are 192-bit, single-use, expiring, claimed atomically; demo seeding impossible against hosted DBs (`lib/runtime-env.ts`); private buckets with ownership checks and short-lived signed URLs; Sentry replay masks all text/inputs.

### 5.3 Correctness bugs

| # | Sev | Bug | Evidence | Fix |
|---|---|---|---|---|
| C1 | High | **Today uses UTC day boundaries.** `todayStart.setHours(0,0,0,0)` runs on Vercel (UTC) (`app/(dashboard)/dashboard/page.tsx:30`). For an NJ agent "today's showings/tasks" is 8 pm-to-8 pm ET; an 8:30 pm showing is missing, and after 8 pm the screen shows tomorrow. Same in the daily cron's "task due today" window (`app/api/notifications/trigger/route.ts:285`). | **[Code]** | Compute boundaries in the agent's timezone (store `agent_profiles.timezone`, default `America/New_York`). |
| C2 | High | **Showing-reminder labels are wrong for afternoon showings.** Cron runs 07:00 UTC (~3 am ET); `dayLabel = hoursAway <= 12 ? "today" : "tomorrow"` labels a 5 pm ET showing (14 h away) "tomorrow". | **[Code]** `app/api/notifications/trigger/route.ts` | Label by calendar date in agent TZ. |
| C3 | High | **Daily digest only reaches the first 50 users.** `supabase.auth.admin.listUsers()` without pagination (`app/api/notifications/trigger/route.ts:198`) returns one page. It also does one activities query per client per agent (N+1) inside a single function invocation. | **[Code]** | Paginate; drive from `agent_profiles`; set-based SQL for "last real contact". |
| C4 | High | **Browser-driven automation fan-out.** `components/AutomationRunner.tsx:15` fires `/api/automation/run` on every app mount; the route loops every client serially and calls Claude per eligible client (`app/api/automation/run/route.ts`). It does not exclude imported sphere/past clients, closed clients or clients who replied; after a 300-contact import, the next day's first open triggers ~300 sequential Claude calls (timeouts, retries on every load, cost) and later creates 300 "5-day check-in" and 300 "Archive / re-qualify" tasks that flood Today. The generated drafts are filtered out of every screen except a count in Ask Aria. | **[Code]** | Delete the client trigger; replace with a server cron + stage-aware eligibility + batch cap (roadmap P5). |
| C5 | High | **"Start Aria" on an existing client always fails.** `POST /api/clients/[id]/aria {action:"start"}` (`app/api/clients/[id]/aria/route.ts:48`) calls `ingestLead(source:"manual")`, which returns early with `firstText: null` for any existing client (`lib/sms/lead.ts:105`) → route answers 409 "already texting". If the client has no phone/email it instead creates a duplicate client. Only matters with SMS on. | **[Code]** | Give "start" its own path: draft first touch + `sendClientSms`. |
| C6 | — | ~~Lead notifications open the wrong screen.~~ **Withdrawn:** `hrefFor` (`components/NotificationPanel.tsx:27`) already routes to `/clients/{related_client_id}` first, and lead notifications set it. | **[Code]** re-checked | None needed. |
| C7 | Medium | **Transactions screen has no entry point.** Only `BottomNav` "activeFor" mentions `/transactions`; nothing links to it. | **[Code]** | Link from client detail, Today closings, and Clients. |
| C8 | Medium | Signed BBA PDF URL saved to `signed_file_url` is a 7-day signed URL (`app/api/bba/sign/[token]/route.ts:250`) — stale after a week if anything reads the column. | **[Code]** | Store path only; sign on read. |
| C9 | Low | Two hardcoded model IDs (`lib/sms/conversation.ts:10`, `lib/inbox/ai.ts:9`) bypass `AI_MODEL`; the CLAUDE.md warns that a retired model fails silently into fallbacks. | **[Code]** | Centralize model constants; add a startup/health probe. |
| C10 | Low | Default town `"Ridgewood"` hardcoded in portal; demo assumptions leak into prod paths. | **[Code]** | |

### 5.4 Compliance & legal exposure (not legal advice — have NJ counsel review)

| # | Sev | Issue | Evidence | Recommendation |
|---|---|---|---|---|
| L1 | **Critical** for a brokerage pilot | **Generic BBA fallback is not a brokerage-grade agreement.** With no template uploaded, the buyer signs a summary naming the *individual agent* as exclusive representative (`app/bba/sign/[token]/page.tsx:297`), with no conspicuous statement that compensation is fully negotiable and not set by law (a required component per NAR's practice changes — [NAR consumer guide](https://www.nar.realtor/the-facts/consumer-guide-written-buyer-agreements)), no ESIGN/UETA consumer consent to electronic records, no copy delivered to the buyer, and no document hash. | **[Code]** | Require a broker-approved template per brokerage before links can be issued; name the brokerage; add negotiability + "can't receive more than agreed" language when templates lack them; e-sign consent checkbox; email the executed PDF to buyer and agent; store SHA-256 of the executed PDF. |
| L2 | High | **SMS consent defaults to "yes" for partner leads.** `autoText: ... body.smsConsent !== false` (`app/api/leads/route.ts:81`) — a missing field means "text them", contradicting the comment above it. Automated AI texts to cell phones need prior express consent under the TCPA; the FCC's one-to-one rule was vacated (Jan 2025, [Venable](https://www.venable.com/insights/publications/2025/01/eleventh-circuit-overrules-fccs-one-to-one)) but the baseline consent requirement remains. | **[Code]** | Require `smsConsent === true` plus a stored consent record (source, text shown, timestamp, IP). |
| L3 | High | **No quiet hours** on Aria's outbound texts (first touch at 2 am is possible). | **[Code]** `lib/sms/*` | Queue texts outside 8 am–9 pm recipient local time. |
| L4 | Medium | **Record retention vs. "Delete account"/"Clear all data".** NJ requires brokers to keep certain records for six years ([N.J.A.C. 11:5-5.4](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-11-5-5-4) for trust funds; transaction-file retention per counsel). In a brokerage, an agent must not be able to destroy brokerage records. | **[Code]** | Brokerage-owned records; soft delete + retention policy; admin-only purge. |
| L5 | Medium | **Gmail restricted scopes** (`gmail.readonly`) require Google verification plus a CASA security assessment for production use; unverified apps show a warning and are capped at 100 users ([Unipile](https://www.unipile.com/integrating-google-oauth-2-0-user-authentication-into-your-app/), [DeepStrike](https://deepstrike.io/blog/google-casa-security-assessment-2025)). Fine for a small pilot; a blocker for scale. If the OAuth app is in "Testing" status, refresh tokens may expire after 7 days. | Consent-screen status **[Unverified]** | Start verification now, or move lead capture to an inbound-email address that needs no restricted scope. |
| L6 | Low | NJMLS IDX notices are rendered only when SimplyRETS is configured — correct today; re-verify when the feed goes live. | **[Code]** | |
| L7 | Low | iOS app is a pure web wrapper of production — App Store "minimum functionality" review risk; and `@capacitor/ios` has a critical advisory. | **[Ran]** audit | Add native push (also needed for lead alerts) and upgrade Capacitor. |

### 5.5 Reliability, scale & operations

| # | Sev | Finding | Fix |
|---|---|---|---|
| R1 | High | **No real-time lead alert** to the agent outside the open app (bell + Realtime only). The only emails are a daily digest and showing reminders. | Native push (Capacitor) + email + optional SMS-to-agent within 60 s of lead creation. |
| R2 | High | **Global, env-level integration config**: one `LEAD_DEFAULT_AGENT_ID`, one IDX site owner (`app/api/listing-inquiries/route.ts:99`), one Meta page, one Twilio default number. Cannot serve a second brokerage. | Per-brokerage integration settings table. |
| R3 | Medium | Upload limit mismatch: 25 MB documents / 15 MB templates through a function body capped at **4.5 MB on every Vercel plan** ([Vercel](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)). Inspection reports and contracts commonly exceed that. | Direct-to-storage signed upload URLs. |
| R4 | Medium | Crons are daily only (comments reference the Hobby plan). Vercel Hobby is for non-commercial use — confirm plan before charging a brokerage. **[Unverified]** | Pro plan; hourly reminder cron. |
| R5 | Medium | No observability of AI cost/latency/failures beyond console logs; fallbacks are silent by design. | Log model, tokens, latency, failure reason per call; alert on fallback rate. |
| R6 | Low | `next build` needed >4 GB heap here. | Size CI runners accordingly. |

---

## 6. Brokerage architecture assessment

**Question: can the current system support multiple brokerages, multiple agents per brokerage, permissions, admin dashboards, shared/private records, team reporting, secure documents and tenant isolation?**

| Capability | Today | Verdict |
|---|---|---|
| Multiple brokerages | `brokerages` table exists; one auto-created per agent (`lib/brokerages.ts`) | **Not supported** — no way to invite/join legitimately; membership exploitable (S1) |
| Multiple agents per brokerage | Only via the exploitable `brokerage_id` self-assignment | **Not supported** |
| Agent-specific data & permissions | Strong: owner RLS on every table | **Supported** (per agent) |
| Brokerage admin dashboards | None; no roles | **Missing** |
| Shared vs private client records | No concept; `clients.brokerage_id` column exists but unused | **Missing** |
| Team activity & performance reporting | None; no response-time capture | **Missing** |
| Secure document storage | Private buckets, service-role access gated by app checks, signed URLs | **Adequate for pilot**; add storage RLS or keep strict server mediation; fix orphaning (S7) |
| Tenant isolation | Per-agent via RLS; integrations global via env; inbound SMS cross-agent match | **Per-agent yes, per-brokerage no** |
| Lead routing | One global default agent | **Missing** (round-robin, rules, re-assignment on no-response) |
| Audit trail | Activities timeline only | **Missing** (who viewed/exported/deleted what) |

**Target model (recommended — shared database, brokerage-scoped RLS; no schema-per-tenant):**

```text
brokerages(id, name, license_no, timezone, settings jsonb)
brokerage_members(brokerage_id, user_id, role: owner|admin|agent, status, invited_by, joined_at)  -- written by service role / admins only
brokerage_integrations(brokerage_id, lead_inbox_address, twilio_number|messaging_service_sid, idx_site_owner, meta_page_id, webhook_key_hash)
lead_routing_rules(brokerage_id, source, strategy: round_robin|owner|rules, sla_minutes, reassign_after_minutes)
clients(+ brokerage_id NOT NULL, + owner_agent_id, + visibility: private|brokerage)
audit_events(brokerage_id, actor_id, action, entity, entity_id, at, meta)
```

RLS pattern: `agent_id = auth.uid()` **OR** (`visibility = 'brokerage'` AND `is_member(brokerage_id)`) **OR** `is_brokerage_admin(brokerage_id)`, implemented with `security definer` helper functions over `brokerage_members`. Admin reporting reads through views/RPCs, not raw tables, so agents' private notes aren't exposed by default. Records belong to the brokerage; agent offboarding reassigns rather than deletes.

Effort: **L (3–4 engineer-weeks)** including policy rewrite, backfill, invite flow, minimal admin view and tests. Details in roadmap P3.

---

## 7. Test & QA gaps

There are no automated tests. The most valuable tests to add first (pure functions, cheap, high leverage):

| Target | Why |
|---|---|
| `lib/sms/lead-sources.ts` parsers | Every lead source depends on them; build fixtures from real redacted Zillow/Realtor.com emails or payloads |
| `lib/matching.ts` / `lib/nj-towns.ts` | Core recommendation correctness |
| `lib/today-items.ts` (`buildTodayItems`, `computeLeadScore`) | Drives the daily plan; timezone cases |
| `lib/inbox/triage.ts` | Must *not* classify portal lead emails as bulk once lead capture exists |
| `lib/bba.ts` term validation + sign route claim/release | Legal record integrity |
| RLS policy tests (pgTAP or SQL scripts against local Supabase) | Tenancy is the riskiest change ahead |
| Playwright smoke: sign-up → onboarding → add client → follow-up draft → BBA link → sign | Catches regressions in the core journey |

---

## 8. Open questions / unverified items

1. Production schema and policies (D3, D4, S1 in prod) — needs a schema dump.
2. Whether SimplyRETS/NJMLS IDX credentials exist and are approved.
3. Twilio A2P 10DLC status; whether any number is registered.
4. Google OAuth app publishing/verification status and scopes approved.
5. Vercel plan (Hobby vs Pro) and function max duration.
6. Resend domain verification for `getariaai.com`.
7. Real Zillow/Realtor.com lead email samples for the agents in the pilot.
8. Supabase project `max_rows` setting.
