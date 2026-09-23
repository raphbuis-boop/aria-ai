# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aria** is an AI-powered real estate CRM for New Jersey agents. It combines Claude AI, Supabase, and SimplyRETS MLS data to provide client management, property matching, and automated communications. Agent-composed SMS opens in the device's native Messages app via `sms:` deep links (see `lib/messaging-links.ts`). The Aria SMS lead flow (`lib/sms/`) is the one exception: it texts leads server-side over Twilio — lead intake (`POST /api/leads`), inbound webhook (`/api/webhooks/twilio/sms`) with Claude replies, showing approvals (`/api/showings/[id]/approve|decline`), and BBA link follow-through. Anything Aria needs the agent for (showing approvals, handoffs, failed texts) is a `showings` row with status `requested` or a `tasks` row with `kind` `aria_*`, surfaced on Today under "Aria needs you".

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint (Next.js config)
```

No test suite is configured.

## Architecture

**Stack:** Next.js 14 App Router · TypeScript · Supabase (auth + DB) · Anthropic Claude · Tailwind CSS (ivory design system) · Capacitor (iOS wrapper)

### Route Groups

- `app/(dashboard)/` — Protected pages: Today (`dashboard`), clients (+ detail with the SMS thread), properties, inbox (Follow-ups), showings, transactions, listings (MLS search), emails (Gmail), inquiries, voice (Ask Aria), settings (+ import, voice)
- `app/api/` — Backend API routes
- `app/login/`, `app/signup/`, `app/portal/`, `app/bba/sign/` — Public pages

### Key Libraries (`lib/`)

| File | Purpose |
|------|---------|
| `lib/ai.ts` | Claude SDK wrapper — `callClaude(system, user, maxTokens)` and `safeJsonParse<T>()` |
| `lib/api-auth.ts` | `getRouteSupabase()` — used in every API route to get `{ supabase, user }` or return 401 |
| `lib/matching.ts` | `scoreFuzzyMatch(client, property)` — weighted score 0–100 (town 35, budget 35, beds 20, baths 10); `MATCH_MIN_SCORE = 60`; handles flex budgets, adjacent towns, bed/bath flex |
| `lib/nj-towns.ts` | NJ town adjacency graph — `normalizeTown()`, `isTownAdjacentOrEqual()`, `getAdjacentTowns()` |
| `lib/compliance.ts` | NJMLS IDX constants and `getIdxDisclaimerText()` — required on all pages displaying MLS data |
| `lib/simplyrets.ts` | SimplyRETS API client helpers |
| `lib/inbox-drafts.ts` | Draft persistence for inbox AI messages |
| `lib/supabase/server.ts` | SSR Supabase client (cookie-based) |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/admin.ts` | Service-role admin client (no auto-refresh) |
| `lib/utils.ts` | `cn()`, `formatPhoneE164()`, `initials()`, `relTime()`, `fmtMoney()`, `fmtDate()` |
| `lib/operator-intent-mappings.ts` | Founder/operator semantic intent → investigative workflows (`expandOperatorPrompt`, `SEMANTIC_DECOMPOSITION_TEMPLATES`). Use for broad prompts (“engineering risks”, “demo prep”, “what should I work on today”) instead of refusing for scope. |

### Operator / planner behavior

Broad founder or product language should be **decomposed into investigations**, not rejected as “too vague”. Before concluding a plan cannot be assembled:

1. Run `expandOperatorPrompt(userRequest)` mentally or import helpers from `lib/operator-intent-mappings.ts` and follow the checklist (git truth, lint/build/typecheck, TODO/FIXME, issues, demo-critical paths).
2. Apply **OPERATIONAL_HEURISTICS** in that module — union matching templates when several apply (e.g. engineering risks + named demo).
3. Do **not** relax safety: auth, secrets, destructive git, or explicit user scope limits stay unchanged.

### Auth Flow

`middleware.ts` guards all routes except `/api/*`, `/portal/*`, `/login`, `/setup`, `/`, `/landing.html`. Authenticated users hitting `/` or `/login` are redirected to `/dashboard`. Unauthenticated users on protected routes go to `/login`.

### API Routes (`app/api/`)

- **`/api/ai/`** — All routes use `callClaude()` from `lib/ai.ts`. Model: `claude-sonnet-4-6`.
  - `POST /api/ai` — General Aria Q&A (max 500 tokens, last 6 message history)
  - `POST /api/ai/draft-text` — Ghost-write SMS (max 150 tokens, saves to `activities` as unapproved AI draft)
  - `analyze-tone`, `cma`, `listing-narrative`, `showing-summary`, `extract-dates`, `market-insight`
- **`/api/mls/`** — SimplyRETS (Basic Auth). `GET listings` fetches/normalizes; `POST apply-matches` runs matching against active clients.
- **`/api/activities/log-send`** — Records a message as sent (insert, or update by `activityId` for an approved draft) after the caller opens an `sms:`/`wa.me` deep link client-side. There is no server-side send.
- **`/api/automation/`** — Scheduled/triggered automation flows.
- **`/api/bba/`**, **`/api/bba-templates/`** — Buyer Broker Agreement generation and template management.
- **`/api/inbox/`** — Inbox message handling.
- **`/api/listing-inquiries/`** — IDX listing inquiry form submissions.
- **`/api/market-pulse/`** — Market trend data.
- **`/api/client-deals/`**, **`/api/client-documents/`** — Deal and document management per client.
- **`/api/enrich/`** — Client data enrichment.
- **`/api/saved-properties/`** — Client saved property lists.

### iOS / Mobile

Capacitor wraps the production web app (`capacitor.config.ts` points to `https://getariaai.com/crm`). The `ios/` directory contains the Xcode project. `next.config.mobile.mjs` is a separate Next.js config for mobile builds. The mobile app is a shell; all logic stays in the web codebase.

### Database

Migrations live in `supabase/migrations/`. Key schema additions (newest first): IDX listing inquiries, contracts & deals, saved properties, buyer broker agreements, showings status/client role, brokerage/matching tables, waitlist/referrals.

## Environment Variables

All secrets live in `.env.local` (never committed). Required vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_SITE_URL
SIMPLYRETS_API_KEY / SIMPLYRETS_API_SECRET / SIMPLYRETS_API_URL
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN          # Aria SMS lead flow
TWILIO_FROM_NUMBER (or TWILIO_PHONE_NUMBER) or TWILIO_MESSAGING_SERVICE_SID
LEAD_WEBHOOK_SECRET                            # bearer token for external lead sources → POST /api/leads
LEAD_DEFAULT_AGENT_ID                          # agent for website/Meta/text-in leads (unset → not auto-created)
META_APP_SECRET / META_VERIFY_TOKEN / META_PAGE_ACCESS_TOKEN / META_LEAD_AGENT_ID?  # /api/leads/meta
GOOGLE_CALENDAR_WRITE=1                        # request calendar.events so approved showings go on Google Calendar
# SMS_DRY_RUN=1 logs texts instead of sending (local testing only)
```

## Conventions

- **Server Components by default** — add `"use client"` only for interactivity/browser APIs.
- **API route auth** — every protected API route must call `getRouteSupabase()` first; return 401 if no user.
- **Three Supabase clients** — use `server.ts` in Server Components/API routes, `client.ts` in Client Components, `admin.ts` only when service-role access is required.
- **Styling** — Tailwind only, no CSS modules. Ivory design system: warm ivory (`--background #FAF6EE`) canvas, white cards, deep green (`--primary #1F5C46`) as the one accent, Fraunces for headings. Use the semantic tokens (`bg-card`, `text-muted-foreground`, `bg-primary/10`…) — never hex colors — so the `.dark` theme (Settings → Appearance, `lib/theme.ts`) works. Shared page primitives live in `components/Section.tsx`.
- **Path alias** — `@/*` maps to the project root.
- **Phone numbers** — always pass through `formatPhoneE164()` before storing or texting.
- **NJMLS IDX compliance** — any page or component that displays MLS listing data must render `<IdxComplianceNotice />` (or equivalent) using the text from `lib/compliance.ts`. This is a legal requirement of the NJMLS IDX agreement.
