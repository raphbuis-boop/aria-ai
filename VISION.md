# Aria — Vision & Build Spec

_The source of truth for what Aria is and what every screen must do. Read this before building or changing any screen. If a decision doesn't serve this doc, don't build it._

---

## What Aria is

**Aria is an AI revenue engine for real estate agents.**

It watches an agent's entire book of business and tells them, every day, exactly where their next commission is and what to do to go get it. It drafts the outreach, flags the deals slipping away, and ranks every action by how much money it's worth.

A CRM runs underneath — Aria needs the client data to work — but Aria is **not sold or framed as a CRM**. A CRM organizes contacts. Aria makes agents money. That distinction drives every screen: lead with opportunity and dollars, never with records.

**Who it's for:** working residential agents who lose commission to disorganization, forgotten follow-ups, and deals going cold without anyone noticing.

---

## The core loop (the "holy shit" moment)

Every client who needs contact today already has a message **drafted and waiting**. The agent opens Aria, sees who's worth reaching (ranked by dollars), reviews the draft, taps, sends.

Following up goes from a chore agents forget → a 30-second morning ritual that directly makes them money. If a demo shows only one thing, it shows this.

---

## The principle every screen obeys

- Lead with **opportunity and dollars**, not data.
- The AI's job is **"go make money" prompts**: who's about to transact, who's slipping away and costing a deal, which action is worth the most — ranked by revenue.
- The CRM data is the engine, never the pitch.
- Every screen answers one question: **"What's my next dollar and how do I get it?"**

---

## The screens (this is the whole v1 — nothing else ships)

**1. Home / Today** _(built)_
The revenue command center. AI insight hero (clients likely to move, projected commission on the table), "needs your attention" (who to contact, closings, hot leads cooling — ranked by value), and a live activity feed. The first thing the agent sees is money on the table.

**2. Clients**
Searchable list of everyone, framed by value and urgency — status, lead heat, last contact, estimated commission, next action at a glance. Filters: hot buyers, sellers, under contract, gone quiet.

**3. Client detail**
One person, everything, money-first: what this deal is worth, an AI briefing ("Marcus is closing Thursday, hasn't been contacted in 4 days — send X"), full timeline, status, next action.

**4. Follow-ups / Messages**
The AI-drafted outreach queue — the home of the core loop. Review, edit, send. Ranked by how much each follow-up is worth.

**5. Properties / MLS**
Browse listings, see match scores to clients, share. Framed as "which of your clients does this make money with."

**Hidden until the core is undeniable:** pipeline, showings, transactions. They exist in the backend; they stay out of the nav until v1 feels finished.

---

## The standard, on every screen

- **Genuinely iOS-native.** Smooth, gesture-driven, haptics on key actions, bottom sheets, fast. If it feels like a web app in a phone frame, it's wrong.
- **Premium and warm.** Matches the Home screen design system — ivory canvas, Fraunces serif headings, deep-green action accent, soft rounded cards, generous space.
- **One cohesive system.** Every screen reuses Home's tokens, spacing, cards, and motion. No one-off styles.

---

## The moat

Distribution. Marc Stein (Links) will call firms and get agents using Aria — a warm channel to the exact buyers, through a trusted name, that no competitor can replicate. This is the rarest asset a startup can have. The entire build is in service of one thing: **making it worthy of Marc putting his name behind it.**

---

## What has to be true before Marc sees it

- The app feels **finished and premium end to end** — not one polished screen and four rough ones.
- The **follow-up loop works** on believable, realistic data.
- **Nothing visibly breaks.**

One lukewarm first impression costs the distribution. Show Marc when it's tight — not when it's "mostly there."

---

## Build method

- One screen at a time, to the premium bar, reviewed on real screenshots before moving on.
- Keep the Supabase backend, auth, and schema. Rebuild the frontend against them.
- Cut scope ruthlessly. A tight app that does 5 things beautifully beats a sprawling one that half-works — and reads as "ready" to Marc.

---

## How the intelligence works (the scoring engine)

_This is the spec for the numbers and signals that make Aria a revenue engine, not a display. Some of this is faked with static seed values today — this section defines the real version to build once the screens are cohesive and Marc is interested. Build the screens first; build this brain second._

### Current state (honest)
- **Deal value** = client's `budget_max`, shown as a headline. Real field, but just their budget, not a prediction.
- **Commission estimate** = deal value × ~2.5% (standard buyer-agent rate). Simple math, reasonable placeholder.
- **Lead heat (hot/warm/cold dots)** = derived from `lead_score` (1–10), which is currently **typed into seed data by hand**. Nothing computes it from behavior yet. This is the weakest link.
- **Status** ("actively touring", "at offer stage") = the real `status` field, set manually.

The app looks intelligent; the intelligence isn't wired yet. That's fine for the demo — but the real version below is what makes it actually work.

### Lead heat — the real version
Heat should be **computed from behavior and timing**, not a static number. Score each client from signals like:
- **Recency of contact** — days since last activity. Fresh contact = warmer; long silence on an active deal = a rescue flag, not just "cold."
- **Engagement signals** — email opens, tour requests, replies, showings booked (needs email/activity tracking wired).
- **Deal stage** — further along (offer, under contract) = hotter and more valuable.
- **Timing pressure** — a closing or key date coming up soon = urgent.
- **Direction of momentum** — heating up (more activity lately) vs cooling (activity dropping off).

Output: a heat tier (hot / warm / cooling / cold) **plus a reason** ("toured twice this week", "gone quiet 141 days before a live deal"). The reason matters as much as the tier — that's what makes it feel like the app is thinking.

### The money numbers — the real version
- **Projected commission** should weight **deal stage and probability**, not just multiply budget. A client under contract closing next week is worth far more, and more certain, than a new lead with a big budget.
- **"Clients likely to move this week / projected commission"** (the Home hero) should rank by expected value = deal value × commission rate × likelihood-to-close-soon, driven by stage + timing + momentum.

### Ranking — the core principle
Everything the agent sees (follow-ups, needs-your-attention, the queue) should be **ranked by dollars at stake and urgency**, so the top of every screen is always the most valuable next action. That ranking is the actual product.

### Build note
This lives in the `lib/ai/` module (currently half-built). Build it **after** the five screens are cohesive and premium — a working scoring engine behind rough screens helps no one; polished screens with placeholder scoring demo fine and buy time to build the brain right.
