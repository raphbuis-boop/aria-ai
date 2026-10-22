# Aria — Product Strategy

_2026-10-22 · Based on the code audit in [ARIA_AUDIT.md](ARIA_AUDIT.md) plus market research. Screen critiques come from reading the code, not from hands-on use against production — I had no production credentials._

---

## 1. Where Aria actually is

**What an agent can do today:** sign up, connect Google, import contacts, and land on a **Today** screen that ranks who to contact (closings, hot leads, missing BBAs, new home matches, people gone quiet, past clients likely to sell, birthdays). Each item opens a **draft text in the agent's voice** that sends from the agent's own phone via the native Messages app. The agent can track clients, upload documents, schedule showings, send a **BBA signing link** with terms they set, reply to Gmail with AI drafts, add homes by pasting a Zillow/Realtor.com link, and ask Aria questions about their own book.

**What it is not yet:** a brokerage product, a lead-response system, or something an agent can rely on when the app is closed. The AI SMS assistant — the most "AI OS" part of the product — is built but switched off pending A2P 10DLC registration and has compliance gaps.

**The honest one-liner:** Aria is a well-built, phone-first, single-agent follow-up assistant with good taste and real gaps in the moments that make or lose money — the first five minutes after a lead arrives, and the broker's view of whether anyone responded.

---

## 2. Strategic recommendation: narrow the wedge

"AI operating system for brokerages" is a fine destination and a bad first pitch. It invites comparison with Follow Up Boss (owned by Zillow since Dec 2023 — [Zillow Group](https://www.zillowgroup.com/news/press/zillow-group-to-acquire-follow-up-boss-an-industry-leader-in-customer-relationship-management)), Lofty, BoldTrail and Sierra, each of which has a decade of CRM features Aria won't match in a year.

**Pilot positioning:**

> **For agents:** "No lead or client falls through the cracks. Aria catches every lead the minute it lands, writes your reply in your voice, and tells you exactly who to call today."
>
> **For brokers:** "See every lead's response time, every agent's follow-up, and every buyer's signed BBA — before it costs you a deal or a complaint."

Why this wedge:

1. **It is where agents demonstrably lose money.** Mike DelPrete's 2024 secret-shopper study found 47% of online property inquiries on agent websites never got a human response ([DelPrete](https://www.mikedp.com/articles/2024/8/13/secret-shopping-47-of-online-property-inquiries-are-ignored)). A vendor audit of the top 74 US brokerages found 41% didn't respond to website leads and under ~10% answered within five minutes ([Luxury Presence summarizing Roof AI](https://www.luxurypresence.com/?p=53210) — vendor data, treat as directional). The widely repeated "21× more likely to qualify within 5 minutes" figure (MIT/InsideSales) is directionally consistent but its primary source is hard to verify.
2. **Aria already has ~70% of the plumbing**: lead intake, Today ranking, voice-matched drafts, follow-up queue, BBA links.
3. **It is measurable in a 60-day pilot** (response time, contact rate, appointments) — which is what a broker needs to renew.
4. **It doesn't require Aria to out-CRM the incumbents**, only to be the fastest, least-effort path from "lead arrived" to "agent replied."

**Don't build now** (and say no when asked): IDX websites, a dialer, social/listing marketing suite (`/listings/new` is already orphaned), a full transaction-management/forms platform (integrate with zipForm/Dotloop/SkySlope later), paid data for seller prediction, a CMA engine, a native Android app.

---

## 3. Screen-by-screen audit

| Screen | Works | Problems | Verdict |
|---|---|---|---|
| **Today** | Genuinely revenue-ranked; honest empty states; live updates via Realtime; one tap to a drafted text. | Day boundaries in UTC (wrong after 8 pm ET). Floods with automation tasks after an import ("5-day check-in" × every contact). No "money at risk" summary. Nothing pushes the agent to open it. | **Keep as the home screen.** Fix TZ + noise, add morning push. |
| **Clients** | Computed lead score with a plain-English reason; import from CSV/Google. | No saved segments (e.g., "past clients in Ridgewood", "leads with no reply in 7 days") — segments are the backbone of reactivation. Default 1,000-row cap. | Add segments + bulk "draft check-ins for this segment". |
| **Client detail** | Preferences, homes, showings, BBA + documents, tasks, timeline in one place. | No link to the client's transaction. Documents fail above 4.5 MB on Vercel. No "next best action" at the top. | Add deal link + next action header. |
| **Follow-ups** | Core loop is right: ranked list → draft → send from own phone. | Send is logged on tap, before the agent actually sends from Messages (`components/DraftSheet.tsx`), so "contacted" can be overstated. Messages to answer live in 5 places (Follow-ups, Emails, Inquiries, bell, "Aria needs you"). | Merge into one **Inbox: needs you** queue. Add "Did you send it?" confirm on return. |
| **Emails (Gmail)** | Triage "needs reply", AI reply drafts, sends in-thread. | Pull-only (no background sync). Likely files portal lead emails as bulk notifications — the opposite of what matters. Restricted scopes need Google CASA beyond 100 users. | Turn into lead capture (see §6), not a second email client. |
| **Properties / Listings** | Graceful no-MLS mode; add-from-link is clever. | Two property concepts (owned `properties` vs MLS `listings`/saved) confuse the mental model. Live MLS depends on SimplyRETS + NJMLS approval. | Keep minimal; it serves matching, not search. |
| **Showings** | Manual scheduling; SMS-requested approvals; calendar write option. | No BBA gate before a showing (the NAR rule is "before touring"). No reminders to the client. | Add BBA-before-showing check. |
| **Transactions** | Dates for inspection, appraisal, commitment, closing; contacts for attorney/lender. | **No way to reach the screen from the app.** No NJ attorney-review milestone, no deadline reminders, no document checklist. | Make reachable; add NJ milestone template + reminders. |
| **Ask Aria (chat/voice)** | Answers from real data with tools; never invents stats; works without AI. | Read-only (can't "text Sarah the Ridgewood listing"). Value overlaps with Today. | Keep; don't invest until the core loop is solid. |
| **Onboarding** | Good sequence: name → Google → import → voice → Today. | Misses the "aha": showing the agent money they're leaving on the table on day one. | Add "missed leads found in your inbox" step (§6). |
| **Settings** | Clear integration status; data reset/delete. | Agent can destroy records a brokerage must keep. | Move destructive actions behind brokerage policy. |
| **BBA signing page (public)** | Clean, mobile, single-use links. | Generic fallback names the agent not the brokerage, lacks negotiability + e-sign consent; no copy emailed to buyer. | Template required; legal language; deliver copies. |
| **Client portal** | — | Dead (no tokens issued); would leak internal tasks if enabled. | Remove until designed. |

**Navigation:** the 5-tab bar (Today · Clients · Aria · Follow-ups · Properties) hides Showings and Transactions under Clients, and Emails/Inquiries under Follow-ups. The money-adjacent screens (deals, showings) are the hardest to reach. **Desktop:** the app is phone-only in layout; agents can live with that, brokers can't.

---

## 4. User journeys — today vs target

### J1. A Zillow lead arrives at 8:47 pm (the money moment)

| Step | Today | Target |
|---|---|---|
| Lead lands | Email from Zillow to the agent's inbox. Aria never sees it (no partner integration; Gmail is pull-only and likely marks it bulk). | Forwarded to the agent's Aria lead address (or detected in Gmail); parsed into a client in < 60 s. |
| Agent knows | When they next open email or Zillow's app. | Push notification + email: "New Zillow lead: Dana, 3BR Montclair, asked about 14 Elm St." |
| First reply | Agent types from scratch. | One tap opens Messages with a drafted reply in the agent's voice referencing the home; timer starts. |
| No reply from lead | Nothing. | Day 1/3/7/14 follow-ups queued on Today; stops when the lead replies. |
| Broker sees | Nothing. | Lead appears on the broker board with response time; unanswered after N minutes → reassign or nudge. |

### J2. Reactivating an imported sphere (cheap, high-ROI)

Today: importing 300 contacts triggers 300 hidden AI drafts and 600 tasks via the browser-driven automation. Target: Aria segments the import (past clients, sphere, stale leads), proposes **10 people this week** with a reason each (home anniversary, equity milestone, birthday, "you sold them a house 5 years ago"), drafts personal check-ins, and tracks replies. Small batches beat blasts — they get sent.

### J3. Buyer from first showing to signed BBA

Today: the agent sets terms and sends a link; works well mechanically. Target: scheduling a showing for a buyer without a signed BBA prompts "Send BBA first" (one tap, terms prefilled from brokerage defaults); signed PDF on brokerage letterhead is emailed to both parties and filed under the client.

### J4. Under contract to closing (NJ)

Today: manual date fields on an unreachable screen. Target: create a deal from the client; Aria applies the NJ timeline template (3-business-day attorney review, inspection, mortgage commitment, appraisal, final walk-through, closing), reminds the agent before each deadline, and shows a document checklist.

### J5. Broker's Monday morning

Today: not possible. Target (desktop): new leads last 7 days by source and agent, median first-response time, leads with no response, buyers touring without BBA, deals closing in 30 days with projected GCI, agents who haven't opened Aria in 5 days.

---

## 5. Revenue opportunities — evaluated

| Opportunity | Agent $ impact | Aria today | Effort | Verdict |
|---|---|---|---|---|
| **Faster lead response** | Highest — directly converts paid leads | Intake exists; no capture of email leads; no real-time alert | M | **Build now** (P4) |
| **Zillow lead response & follow-up** | High for Premier Agent users (expensive leads) | Webhook parser nobody can call | M via email; partner listing later | **Build now via email capture**; apply to Zillow App Integrations in parallel |
| **Neglected revenue / daily plan** | High — focuses limited time | Strong ranking in `lib/today-items.ts` | S | **Fix and promote** (TZ, noise, morning push, "money at risk") |
| **Reactivating old leads & sphere** | High, low cost — repeat/referral business | Keep-in-touch + seller-propensity heuristics exist | S–M | **Build now** as segments + weekly batches (P5) |
| **Automated lead qualification** | Medium–high | Claude SMS conversation built, flag off | M + A2P 10DLC + consent | **Next** — after pilot proves the manual loop; start with "draft the qualifying question", not autonomous texting |
| **Booking more showings** | Medium | SMS showing requests (off); manual showings | M | **Next** — BBA gate + client confirmations; ShowingTime later |
| **Managing active deals** | Medium (protects closings) | Tracker exists but unreachable | M | **Next** (P7) |
| **Preparing transaction documents** | Medium, high liability | BBA only | L | **Integrate later** (NJ Realtors forms via zipForm/Dotloop/SkySlope) — don't build forms |
| **Finding buyers & sellers** | Potentially high, speculative | Heuristic seller propensity on past clients | L + data costs | **Later** — validate with pilot data first |
| **Brokerage reporting** | Drives the buying decision | None | M | **Build a minimal version for the pilot** (P8) |

---

## 6. The biggest opportunity: missed-lead recovery + instant response

**The idea:** Aria becomes the place every lead lands within a minute, regardless of source, and the agent can't miss it.

1. **Capture without partnerships.** Give each agent (and brokerage) an Aria lead address. Agents add it to Zillow/Realtor.com/Homes.com lead notifications or set a Gmail forward rule; Aria parses the email into a client. Zillow's official CRM path is its partner App Integrations list ([Lofty help](https://help.lofty.com/hc/en-us/articles/40537729986075-Zillow-Integration), [Wise Agent setup](https://wise-agent-crm.instantdocsbase.com/help/zillow-premier-set-up)); email parsing is the standard fallback every CRM supports. Apply for partner status in parallel.
2. **The onboarding "aha": scan the last 90 days of Gmail** (scope already granted) for portal lead emails and show: _"We found 14 leads from Zillow and Realtor.com. 6 never got a reply. Want drafts?"_ That is a dollar figure on day one.
3. **Alert in under 60 seconds** via native push (the Capacitor app needs it anyway), email, and optionally SMS to the agent.
4. **One-tap first reply** drafted in the agent's voice, referencing the listing they asked about — sent from the agent's own phone (no A2P needed).
5. **Follow-up until they answer**, then stop. Server-side, stage-aware, small batches on Today.
6. **Broker accountability:** response-time clock per lead, SLA breach → nudge, then reassign.

**Why Aria can win this:** it's narrow, measurable, works with the agent's existing lead spend, and reuses Aria's strongest assets (voice-matched drafting, Today ranking). The incumbents do lead routing, but they win on breadth; Aria wins on "it just catches everything and writes the reply."

---

## 7. What a brokerage buys

| Broker pain | Aria answer | Pilot metric |
|---|---|---|
| Paid leads die unanswered | Capture + alert + SLA + reassign | Median first-response time; % contacted < 1 h |
| Agents don't follow up | Today + follow-up cadences | % leads touched day 1/3/7 |
| NAR/BBA compliance risk | BBA required before showing; versioned signed records | % first showings with signed BBA |
| No visibility | Minimal team board | Weekly broker usage |
| Records walk out the door | Brokerage-owned data, retention | — |

**Packaging hypothesis (to test, not decided):** free 60-day pilot for one office, then per-agent monthly seat plus a small brokerage platform fee. Incumbents range roughly $58–$416/month for Follow Up Boss tiers per third-party comparisons ([The Real Stack](https://therealstack.co/best-ai-crm-real-estate-agents/)) — Aria should price as an add-on to whatever CRM the brokerage already pays for until it can replace it.

---

## 8. Competitive landscape (short)

| Product | Strength | Where Aria differs |
|---|---|---|
| Follow Up Boss (Zillow) | CRM hub, routing, deep Zillow sync | Aria: AI drafting in agent's voice, opinionated daily plan, phone-first; must coexist (export/sync) rather than replace |
| Lofty | All-in-one with IDX + AI assistant | Aria: no website/IDX bloat; NJ-specific BBA + deal timeline |
| BoldTrail / kvCORE, Sierra, Real Geeks | Brokerage-wide platforms with lead gen | Aria: lightweight, fast to adopt, works alongside |
| AI ISA services (e.g., Structurely, Ylopo AI) | Autonomous qualification over text | Aria: agent-in-the-loop by default; autonomous texting only after consent + A2P |

Sources: [Sierra Interactive comparison](https://www.sierrainteractive.com/insights/blog/best-real-estate-crm/), [The Real Stack](https://therealstack.co/best-ai-crm-real-estate-agents/), vendor docs. Most comparison content is vendor-written; treat rankings as soft.

---

## 9. Pilot success metrics (instrument these before launch)

1. Median minutes from lead arrival to first agent touch (target: < 5 business-hours, < 15 overall).
2. % of new leads contacted within 1 hour (target: > 80%).
3. % of new leads with ≥ 3 touches in 14 days unless they replied.
4. Appointments (showing or consult) per 100 new leads, vs the brokerage's prior baseline.
5. % of first showings with a signed BBA (target: 100%).
6. Weekly active agents (Today opened ≥ 4 days/week).
7. Drafts sent ÷ drafts generated (measures draft quality).
8. Broker: "would you pay to continue?" at day 45.

---

## 10. Key risks

| Risk | Mitigation |
|---|---|
| Lead-email formats change / parsing misses | Fixture tests per source; fallback "unparsed lead" card; human review queue |
| Google restricted-scope verification delays | Lead address (no Gmail scope) is the primary path; Gmail scan is a bonus |
| TCPA/A2P exposure from AI texting | Keep agent-sends-from-own-phone for pilot; autonomous texting only with explicit consent records, quiet hours, registered numbers |
| Agents won't change habits | Push notifications + one-tap actions; measure WAU weekly and interview drop-offs |
| Broker data-ownership concerns | Brokerage-owned records, audit log, export |
