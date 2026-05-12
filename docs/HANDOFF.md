# Aria — Tooling Setup Handoff

You're picking up an in-progress tooling setup for the Aria AI codebase at `/Users/raphaelwasserlauf/AriaAI-Production`. Production site is **getariaai.com**, hosted on Vercel project **`raphbuis-boops-projects/aria-ai`** (note: this is the TEAM scope, not the personal `raphbuis-boop` scope — they're two different projects, the team scope is the real one).

GitHub repo: `github.com/raphbuis-boop/aria-ai`

## The blocking issue right now

`npm audit fix --force` was run on this codebase earlier today. It silently bumped:

- `next` 14.2.35 → **16.2.6** ← root cause of everything broken right now
- `eslint-config-next` 14.2.35 → 16.2.6
- `@anthropic-ai/sdk` 0.80.0 → 0.95.2

Next 16 makes Turbopack the default bundler. Sentry's `withSentryConfig` is webpack-based, so most of its features ("disableLogger", "automaticVercelMonitors", source map upload) are explicitly "Not supported with Turbopack". Every Vercel build since the audit-fix has failed with a different Sentry/Turbopack incompatibility — we keep patching one error and hitting the next.

## The fix

Downgrade Next.js back to 14.2.35. The Aria codebase was designed for Next 14; downgrading restores webpack as the bundler, makes Sentry's plugin work as designed, and removes the `middleware`→`proxy` deprecation noise.

Do this from `/Users/raphaelwasserlauf/AriaAI-Production`:

```bash
npm install next@14.2.35 eslint-config-next@14.2.35 --legacy-peer-deps
npm run build      # verify locally
git add -A
git commit -m "Downgrade Next.js to 14.2.35 — revert audit fix major bump"
git push
npx vercel --prod --yes
```

**Important:** do NOT run `npm audit fix --force` again. The audit warnings can be addressed later by upgrading one package at a time, not via a force-bump.

The Vercel CLI is currently linked to the correct project (`raphbuis-boops-projects/aria-ai`). Verify with `npx vercel ls --prod` if needed.

## What was already set up before the build broke

### 1. PostHog (product analytics)

- **Installed**: `posthog-js`
- **Files added/modified**:
  - `app/providers.tsx` — client-side `PostHogProvider` (initializes once via `useEffect`, `capture_pageview: false`, `person_profiles: "identified_only"`)
  - `app/PostHogPageView.tsx` — manual `$pageview` capture on App Router route changes
  - `app/layout.tsx` — wraps children in `<PostHogProvider>`
  - `lib/analytics.ts` — typed `track()`, `identify()`, `resetUser()` helpers with `AriaEventMap` covering `inquiry_submitted`, `client_created`, `voice_ai_used`
  - `components/ListingInquiryForm.tsx` — fires `inquiry_submitted` on success
  - `app/(dashboard)/referrals/page.tsx` — fires `client_created` on referral accept
  - `components/VoiceAssistantPanel.tsx` — fires `voice_ai_used` on mic toggle
- **Env vars (Vercel + .env.local)**: `NEXT_PUBLIC_POSTHOG_KEY=phc_ovotVVCktZoNdhT54pdBJC8Dqbum27L6PEns9n4nLUsN`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`
- **Dashboard**: https://us.posthog.com/project/417944
- **Status**: code is correct; pending successful deploy + verification

### 2. Sentry (error monitoring)

- **Installed**: `@sentry/nextjs@10.52.0`
- **Files added/modified**:
  - `sentry.client.config.ts` — browser SDK with session replay, PII masked (`maskAllText`, `maskAllInputs`, `blockAllMedia`)
  - `sentry.server.config.ts` — Node runtime
  - `sentry.edge.config.ts` — edge runtime
  - `instrumentation.ts` — Next.js instrumentation hook; uses `captureRequestError as onRequestError` (renamed in Sentry v10)
  - `next.config.mjs` — wrapped with `withSentryConfig({ org: "aria-ec", project: "javascript-nextjs", tunnelRoute: "/monitoring", widenClientFileUpload: true })`
  - `app/sentry-example-page/page.tsx` — public smoke-test page with "Throw a test error" button
  - `middleware.ts` — added `path === "/sentry-example-page"` to public allowlist
- **Env vars (Vercel + .env.local)**:
  - `NEXT_PUBLIC_SENTRY_DSN=https://e2951d59eb2ff1f71a038e98aca49aa6@o4511373879738368.ingest.us.sentry.io/4511373888323584`
  - `SENTRY_DSN` = same
  - `SENTRY_ORG=aria-ec`
  - `SENTRY_PROJECT=javascript-nextjs`
  - `SENTRY_AUTH_TOKEN=sntrys_eyJpYXQiOjE3Nzg1NDMzNjMu...` (already in .env.local; production-only in Vercel)
- **Dashboard**: https://aria-ec.sentry.io/issues/?project=javascript-nextjs (use "Errors & Outages", NOT "Feed")
- **Status**: code is correct, latest fix was the `captureRequestError` rename; pending successful deploy

### 3. shadcn/ui

- **Installed**: `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `tailwindcss-animate`
- **Files added/modified**:
  - `components.json` — shadcn config (`cssVariables: false`, baseColor: neutral)
  - `components/ui/button.tsx` — variants: default/destructive/outline/secondary/ghost/link, sizes: sm/default/lg/icon
  - `components/ui/card.tsx` — Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter
  - `components/ui/dialog.tsx` — Radix-powered modal with all sub-components
  - `components/ui/tabs.tsx` — Radix tabs
  - `components/ui/sonner.tsx` — Sonner-based Toaster (coexists with existing `ToastProvider`, not mounted yet)
  - `lib/utils.ts` — `cn()` upgraded to use clsx + tailwind-merge (backwards compatible)
  - `tailwind.config.ts` — added `tailwindcss-animate` plugin
- All components styled with the existing Aria design tokens (`bg-card`, `accent-blue`, `border-card`, etc.) — no CSS variable theme migration needed
- **To add more components later**: `npx shadcn@latest add <name>`

### 4. Bruno API collection

- Created in `/bruno/`:
  - `bruno.json` — collection config
  - `environments/Local.bru` (baseUrl: `http://localhost:3000`) and `Production.bru` (baseUrl: `https://getariaai.com`)
  - `Listing Inquiries - Submit (POST).bru` — public POST with full body
  - `Listing Inquiries - List (GET).bru` — auth-required GET with `?status=` filter
  - `Notifications - List (GET).bru` — auth-required GET
  - `AI - Ask Aria (POST).bru` — auth-required POST with example question + history
  - `README.md` — how to grab the Supabase session cookie from browser DevTools and paste into Bruno's `supabaseAccessToken` secret env var
- **To use**: `brew install --cask bruno`, then Open Collection → pick `/bruno/`

### 5. Outreach drafts (saved in `/docs/outreach/`)

- `DOMA-partnership.md` — partnership inquiry to `education@doma.com` (their AgentMarketplace contact)
- `HouseCanary-api-access.md` — API access ask (no published sales email — recommends developer-account-first approach)
- `Twilio-appeal.md` — toll-free verification appeal, full body addressing the 3 original rejection reasons (non-business email, opt-in URL, privacy policy)
  - Must be filed as a **Console support ticket**, not email
  - Subject must match Twilio's required format: `Toll-Free Verification Rejection Appeal for Aria (+1XXXXXXXXXX)`
- Each file has "Notes for sending" with tactical advice

### 6. Config patches done

- `vercel.json` — crons changed from hourly to daily (Hobby plan only allows daily crons): `0 7 * * *` for showing reminders, `0 8 * * *` for daily summary
- `middleware.ts` — `/sentry-example-page` added to public allowlist
- `.npmrc` — added `legacy-peer-deps=true` so Vercel npm install doesn't choke on the eslint version conflict (this can be removed after Next downgrade since the conflict goes away with eslint-config-next@14)

## Still pending (need account signups by Raph)

These don't involve code — just account creation + dashboard tour:

### v0.dev
- Sign in at https://v0.dev using Raph's Vercel account (`raphbuis-boop`)
- Walk through generating one example React component
- Show the copy-paste flow back into the codebase

### Linear
- Free tier signup at https://linear.app/signup
- Workspace name: `Aria`
- Set up basic states: Inbox, Backlog, In Progress, Done
- Raph will paste the current feature roadmap to be imported

### Stripe
- Signup at https://dashboard.stripe.com/register (no activation, no bank info — just account creation in test mode)
- Confirm test mode keys are available
- Defer real integration

## Final summary doc

After the deploy succeeds, write a final summary at `/docs/SETUP-SUMMARY.md` covering:
- Every env var now in Vercel (PostHog, Sentry, plus the original ones)
- Every dashboard URL (PostHog, Sentry, Linear, Stripe, Vercel, GitHub)
- First-action checklist per tool (e.g., "Sentry: confirm test error appeared → set up alerts → integrate Slack")

## Critical things to know

- **Two Vercel projects exist with the name `aria-ai`**: `raphbuis-boop/aria-ai` (personal, mostly empty) and `raphbuis-boops-projects/aria-ai` (team, real production). The CLI is linked to the team one. The domain getariaai.com is on the team one. Don't get confused.
- **`.env.local`** already contains all current env values including the Sentry auth token
- **Don't change** `tsconfig.json` paths (`@/*` alias is critical) or the `lib/api-auth.ts` pattern (every API route uses it)
- **Don't run** `npm audit fix --force` — that's what caused this whole mess

Good luck.
