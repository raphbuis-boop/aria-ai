# Aria — BUILD.md · Phase: Revenue Intelligence

> Read `VISION.md` first. This doc is the next build phase after the polish/deploy
> pass. **Do not start this until the polish deploy is live** (production
> getariaai.com/crm matches the local tree). Everything here serves ONE thing:
> making Aria's core claim literally true — *"Aria tells you who's about to make
> you money and hands you the message to send."*

---

## The thesis (read this before writing code)

We audited the AI real-estate CRM market (Lofty, BoldTrail, Follow Up Boss,
Structurely, RealScout, Cotality). Conclusion:

- The features below are **table stakes** — competitors already have versions of
  them. Building them gets us to **parity**, so the app doesn't look thin. Parity
  is the cost of entry, **not** the moat.
- **The moat is synthesis + focus:** competitors scatter signals across ten
  dashboards and make the agent do the thinking. Aria collapses every signal into
  ONE ranked, drafted, ready-to-send daily action: *"here's your next dollar."*
- Therefore: every feature in this doc must **feed the ranked revenue verdict** —
  the Home hero, the "needs your attention" list, and the Follow-ups queue. A
  feature that adds a signal but doesn't change what rises to the top of those
  lists is not done.

### Hard guardrails (do NOT build these)
- No IDX/agent websites, no social-media posting, no power dialer, no generic drip
  suites, no inbound cold-lead chatbot. That is the incumbent sprawl VISION rejects.
- No new top-level nav tabs. These features enrich the 5 existing screens.
- Keep the ivory / Fraunces / deep-green (`--primary #1F5C46`) design system. Reuse
  existing tokens and components (`PageContainer`, `DraftSheet`, `Card`, `Button`).
  No one-off styles, no blue.

---

## Priority order

1. **P1 — Behavioral lead heat** (do first; highest leverage, mostly plumbing we have)
2. **P2 — Natural-language MLS search** (cheap, demos extremely well to Marc)
3. **P3 — Propensity-to-sell scaffold** (interface now, paid data later — v2 wedge)

Ship P1 fully (build → verify → deploy) before starting P2.

---

## P1 — Behavioral lead heat  ★ the product-defining one

**Goal:** replace the partly-static lead score with one driven by real client
behavior, and surface the *reason* in plain English everywhere heat is shown.

**Why it's the moat-maker:** VISION calls lead heat "the weakest link" — today
`computeLeadScore()` (in `lib/today-items.ts`) runs off status, contact recency,
closing proximity, and logged-activity momentum, but has **no signal for what a
client actually does** (which listings they view/favorite). That behavioral signal
is what BoldTrail and RealScout ("Scout Score") use. We already have the skeleton:
a client portal (`app/portal`, `app/property-search`), `property_matches`,
`user_saved_properties`, and `idx_listing_inquiries`. We just don't capture views
or feed engagement into the score.

### What to build
1. **Capture engagement events.** Add a `client_engagement_events` table
   (`agent_id`, `client_id`, `property_id` nullable, `event_type`
   [`view` | `favorite` | `unfavorite` | `inquiry` | `search` | `alert_open`],
   `created_at`, `metadata` jsonb). RLS scoped by `agent_id` exactly like `clients`.
   - Log `view` from the portal / `app/property-search` when a client opens a
     listing detail (debounced, one per listing per session).
     - Backfill `favorite` from `user_saved_properties` and `inquiry` from
     `idx_listing_inquiries` so the signal isn't empty on day one.
2. **Feed engagement into `computeLeadScore()`.** Extend its inputs to accept
   recent engagement events and add scoring:
   - Recent views (last 7d): small boost, scaled by count.
   - Favorite / saved property: meaningful boost (high intent).
   - Inbound inquiry: high boost.
   - **Momentum direction:** engagement rising vs falling over the last 14d —
     rising = warmer, a live deal going quiet = a *rescue flag* (surface as urgent,
     not just "cold"), per VISION.
   - Keep the 0–10 clamp and the existing status/recency/closing logic.
3. **Upgrade `leadScoreReason`** to name the strongest behavioral factor, e.g.
   "viewed 3 Fort Lee listings this week", "favorited a $1.2M home yesterday",
   "gone quiet 12 days before a live deal". The reason matters as much as the tier.
4. **Re-rank everything by it.** Confirm the new heat + momentum flows through
   `buildTodayItems()` so Home's "needs your attention", the Home hero, and the
   Follow-ups queue reorder to put behaviorally-hot clients on top.

### Files
- `lib/today-items.ts` — `computeLeadScore`, `buildTodayItems`, `TodayActivity`/new
  engagement input type, `leadScoreReason`.
- `supabase/migrations/` — new `client_engagement_events` table + RLS + backfill.
- `app/portal/*`, `app/property-search/*` — emit `view`/`favorite` events.
- `app/(dashboard)/dashboard/page.tsx` + `inbox/page.tsx` — fetch engagement events
  in the existing `Promise.all` and pass to `buildTodayItems`.

### Acceptance criteria
- A client who views/favorites listings in the portal visibly rises in Home's
  "needs your attention" and the Follow-ups queue within one refresh.
- Every heat badge has a behavior-aware reason string (no bare "hot"/"cold").
- A live deal (status offer/under_contract) that goes quiet surfaces as a **rescue**
  flag near the top, not buried as "cold".
- Zero hand-typed `lead_score` dependence for the tier shown to the agent.
- Scoped by `agent_id`; no cross-agent leakage (match existing RLS tests).

### Out of scope
- Email open/click tracking (needs sending-infra pixels) — leave a TODO hook, don't build.

---

## P2 — Natural-language MLS search

**Goal:** let the agent (and client, in the portal) describe a home in plain English
— "3-bed fixer under $1M in Tenafly with a pool or ADU" — and get matching listings,
instead of rigid filter boxes. RealScout's headline feature; a strong Marc demo.

### What to build
- New AI endpoint `app/api/ai/search-parse/route.ts`: takes NL text, returns a
  structured filter object (town(s), beds, baths, price min/max, property type,
  keywords/features) using `callClaude` (see `lib/ai`), validated/clamped.
- Wire it into the existing search UIs (`app/(dashboard)/properties`, `app/mls`,
  `app/property-search`) — an NL input that runs the parse then the existing query.
- Keep results framed the Aria way: each result shows **which of the agent's clients
  it makes money with** (reuse the `property_matches` / match-score display already
  on the Properties screen).

### Files
- `app/api/ai/search-parse/route.ts` (new), `lib/ai/*`.
- `app/(dashboard)/properties/properties-client.tsx`, `app/mls/*`, `app/property-search/*`.

### Acceptance criteria
- A plain-English query returns sensible listings and never crashes on gibberish
  (falls back to keyword search).
- Results keep the client-match framing (not just a listing dump).
- Same ivory design; the NL box reuses the existing search styling.

### Out of scope
- Replacing the structured filters — NL is *additive*, filters stay.

---

## P3 — Propensity-to-sell (scaffold only now)

**Goal:** the proactive seller-lead engine — flag people in the agent's sphere
likely to list soon, *before* they do. Highest ceiling (turns Aria from reactive to
proactive), but real data needs a paid provider (Cotality-class propensity scores /
AVM). **Build the interface now, stub the data.**

### What to build (now)
- A `sellerPropensity(client)` function in `lib/ai/` returning
  `{ score: 0-100, band: 'high'|'watch'|'low', reasons: string[] }`, computed from
  what we already have (years since `home_purchase_date`, life-event fields, budget,
  status) as a **placeholder**, behind a clean interface so a real data source can
  drop in later.
- Surface high-propensity clients in Home's "needs your attention" as a distinct
  "likely to sell" item type, ranked into the same $ queue.
- Leave a documented `PROPENSITY_PROVIDER` seam (env-gated) for a future paid feed.

### Acceptance criteria
- At least one "likely to sell" opportunity appears in the ranked queue from stub
  data, styled consistently, with a plain-English reason.
- The data source is swappable without touching the UI.

### Out of scope
- Signing/integrating any paid data provider — that's a separate business decision.

---

## Definition of done for the phase
- `next build` clean; no new lint/type errors.
- Everything ranked by **dollars × likelihood × urgency** — the top of every screen
  is the most valuable next action (VISION's core principle).
- No blue, no new nav tabs, no incumbent-sprawl features.
- Verified in the iOS simulator (loads live prod) after deploy: behaviorally-hot
  clients rise, reasons read naturally, NL search works, a seller-propensity item
  appears.
- Commit + push to main so Vercel deploys; hard-reload the simulator to confirm.
