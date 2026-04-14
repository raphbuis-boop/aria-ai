# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aria** is an AI-powered real estate CRM for New Jersey agents. It combines Claude AI, Supabase, Twilio SMS, and SimplyRETS MLS data to provide client management, property matching, and automated communications.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint (Next.js config)
```

No test suite is configured.

## Architecture

**Stack:** Next.js 14 App Router · TypeScript · Supabase (auth + DB) · Anthropic Claude · Twilio · Tailwind CSS (dark theme)

### Route Groups

- `app/(dashboard)/` — All protected pages (clients, properties, pipeline, inbox, MLS, showings, transactions, etc.)
- `app/api/` — Backend API routes
- `app/login/`, `app/setup/`, `app/portal/` — Public pages

### Key Libraries (`lib/`)

| File | Purpose |
|------|---------|
| `lib/ai.ts` | Claude SDK wrapper — `callClaude(system, user, maxTokens)` and `safeJsonParse<T>()` |
| `lib/api-auth.ts` | `getRouteSupabase()` — used in every API route to get `{ supabase, user }` or return 401 |
| `lib/matchProperties.ts` | Scores clients against properties (budget 40pts, town 30pts, beds 20pts, baths 10pts; min 40 to match) |
| `lib/supabase/server.ts` | SSR Supabase client (cookie-based) |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/admin.ts` | Service-role admin client (no auto-refresh) |
| `lib/utils.ts` | `cn()`, `formatPhoneE164()`, `initials()`, `relTime()`, `fmtMoney()`, `fmtDate()` |

### Auth Flow

`middleware.ts` guards all routes except `/api/*`, `/portal/*`, `/login`, `/setup`, `/`, `/landing.html`. Authenticated users hitting `/` or `/login` are redirected to `/dashboard`. Unauthenticated users on protected routes go to `/login`.

### AI API Routes (`app/api/ai/`)

All routes use `callClaude()` from `lib/ai.ts`. Current model: `claude-sonnet-4-6`.

- `POST /api/ai` — General Aria Q&A (max 500 tokens, last 6 message history)
- `POST /api/ai/draft-text` — Ghost-write SMS from voice samples (max 150 tokens, saves to `activities` table as unapproved AI draft)
- `/api/ai/analyze-tone`, `/api/ai/cma`, `/api/ai/listing-narrative`, `/api/ai/showing-summary`, `/api/ai/extract-dates`, `/api/ai/market-insight`

### MLS Integration (`app/api/mls/`)

Uses SimplyRETS API (Basic Auth). `GET /api/mls/listings` fetches and normalizes listings. `POST /api/mls/apply-matches` runs the property-matching algorithm against the current agent's active clients.

### SMS (`app/api/sms/send/`)

Twilio integration. Validates phone via `formatPhoneE164()`, sends SMS, and writes to the `activities` table (marks `sent: true`, `approved: true`).

## Environment Variables

All secrets live in `.env.local` (never committed). Required vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER
NEXT_PUBLIC_SITE_URL
SIMPLYRETS_API_KEY / SIMPLYRETS_API_SECRET / SIMPLYRETS_API_URL
```

## Conventions

- **Server Components by default** — add `"use client"` only for interactivity/browser APIs.
- **API route auth** — every protected API route must call `getRouteSupabase()` first; return 401 if no user.
- **Three Supabase clients** — use `server.ts` in Server Components/API routes, `client.ts` in Client Components, `admin.ts` only when service-role access is required.
- **Styling** — Tailwind only, no CSS modules. Dark theme: black (`#000000`) background, `#111111` cards, `#222222` borders.
- **Path alias** — `@/*` maps to the project root.
- **Phone numbers** — always pass through `formatPhoneE164()` before storing or sending via Twilio.
