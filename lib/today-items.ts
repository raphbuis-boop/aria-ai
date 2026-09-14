import { differenceInCalendarDays } from "date-fns";
import { sellerPropensity } from "./ai/seller-propensity";

// Client status values (as of May 2026):
//   new | contacted | showing | offer | under_contract | closed
// "showing" or lead_score >= 8 = hot lead candidate
// "new" through "offer" = active buyer (eligible for MLS match nudges + BBA reminders)
// "under_contract" / "closed" = handled by transactions or excluded

// ─── Input types ─────────────────────────────────────────────────────────────

export type TodayClient = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone: string | null;
  birthday: string | null;
  home_purchase_date: string | null;
};

export type TodayTransaction = {
  id: string;
  client_id: string;
  address: string | null;
  closing_date: string | null;
  status: string | null;
  contract_price?: number | null;
};

/** One signed Buyer Broker Agreement — the real commission rate for that client, in place of the 2.5% assumption. */
export type BbaCommission = {
  client_id: string;
  commission_pct: number | null;
};

export type TodayActivity = {
  client_id: string;
  created_at: string;
  type: string | null;
  direction: string | null;
};

export type NewMatchItem = {
  clientId: string;
  propertyAddress: string | null;
};

// ─── Output type ─────────────────────────────────────────────────────────────

export type ActionType = "text" | "navigate";

export type LeadHeat = "hot" | "warm" | "cold";

export type TodayEngagementEvent = {
  client_id: string;
  /** portal_open | view | favorite | inquiry | search | alert_open */
  event_type: string;
  created_at: string;
  listing_address?: string | null;
  mls_number?: string | null;
};

export type TodayItem = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientTown: string | null;
  clientBudgetMax: number | null;
  clientStatus: string | null;
  reason: string;
  context: string | null;
  actionLabel: string;
  actionType: ActionType;
  navigateTo: string | null;
  urgencyRank: number;
  transactionId?: string;
  propertyAddress?: string | null;
  /** 0–10 computed lead score based on behavior and timing — the real signal behind the heat badge. */
  leadScore: number | null;
  /** hot ≥8, warm ≥5, else cold. Null score reads as cold (nothing to base "hot" on). */
  leadHeat: LeadHeat;
  /** Short plain-English reason for the lead score (e.g. "gone quiet 12 days", "closing in 3 days"). */
  leadScoreReason: string | null;
  /** Plain-English label for the client's most recent logged activity, e.g. "Replied to your text 2 days ago". Null when there's no activity history. */
  activitySignal: string | null;
  /**
   * Expected commission — deal value × the client's real BBA commission rate
   * (falls back to 2.5% if unsigned) × probability of the deal actually
   * closing (deal stage + closing proximity). This is the "real dollars at
   * stake" figure that drives the Home hero total and the Follow-ups
   * ranking — NOT the full commission you'd earn if the deal closes today.
   * Null when there's no deal value to estimate from (no budget, no deal).
   */
  commissionEst: number | null;
};

// ─── Label helpers ────────────────────────────────────────────────────────────

/** Detects couple names: contains &, and, or / between names */
function isCouple(name: string): boolean {
  return /\s+(?:&|and|\/)\s+/i.test(name);
}

/**
 * Pluralizes a last name for "the Roths" / "the Joneses" style labels.
 * Strips hyphenated prefix first: "Smith-Roth" → "Roth".
 */
function pluralizeCoupleLastName(lastName: string): string {
  const base = lastName.includes("-") ? lastName.split("-").pop()! : lastName;
  // Ends in s/x/z/ch/sh → add "es"
  if (/(s|x|z|ch|sh)$/i.test(base)) return `${base}es`;
  // All other cases → add s (Kennedy → Kennedys, Roth → Roths, Chen → Chens)
  return `${base}s`;
}

/**
 * Returns the shared last name (last word of the full name string).
 * Works for "Mike & Linda Roth", "Sarah and James Jones", "Emma & Tom Smith-Roth".
 */
function coupleLastName(name: string): string {
  return name.trim().split(/\s+/).pop() ?? name;
}

/**
 * "Mike Rodriguez" → "Mike"
 * "Mike & Linda Roth" → "the Roths"
 * "Sarah and James Jones" → "the Joneses"
 * "Emma & Tom Smith-Roth" → "the Roths"
 */
function textRecipient(name: string): string {
  if (isCouple(name)) {
    const lastName = coupleLastName(name);
    return `the ${pluralizeCoupleLastName(lastName)}`;
  }
  return name.split(" ")[0];
}

/**
 * "John Peterson" → "View John's file"
 * "Mike & Linda Roth" → "View the Roths' file"
 * "Sarah and James Jones" → "View the Joneses' file"
 */
function closingLabel(name: string): string {
  if (isCouple(name)) {
    const lastName = coupleLastName(name);
    const plural = pluralizeCoupleLastName(lastName);
    // Possessive: "Roths'" / "Joneses'"
    return `View the ${plural}' file`;
  }
  return `View ${name.split(" ")[0]}'s file`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHot(c: TodayClient): boolean {
  if (c.status === "under_contract" || c.status === "closed") return false;
  return c.status === "showing" || (c.lead_score ?? 0) >= 8;
}

const ACTIVE_BUYER_STATUSES = ["new", "contacted", "showing", "offer"];

function fmtBudget(min: number | null, max: number | null): string | null {
  const lo = min ?? 0;
  const hi = max ?? 0;
  if (!lo && !hi) return null;
  function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  }
  if (lo && hi) return `${fmt(lo)}–${fmt(hi)}`;
  if (hi) return `up to ${fmt(hi)}`;
  return `${fmt(lo)}+`;
}

function isAnniversaryToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00");
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function daysSinceContact(clientId: string, activities: TodayActivity[]): number | null {
  const clientActivities = activities.filter((a) => a.client_id === clientId);
  if (clientActivities.length === 0) return null;
  const latest = clientActivities.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b,
  );
  return differenceInCalendarDays(new Date(), new Date(latest.created_at));
}

export function heatFromScore(score: number | null): LeadHeat {
  if (score == null) return "cold";
  if (score >= 8) return "hot";
  if (score >= 5) return "warm";
  return "cold";
}

/**
 * Computes a dynamic lead score (0-10) based on real signals:
 * - Deal stage (status)
 * - Recency of contact (days since last activity)
 * - Closing proximity (days until closing)
 * - Activity momentum (recent frequency)
 * - Engagement levels (showings, offers, etc.)
 *
 * Returns an object with the score and a short reason string.
 */
export function computeLeadScore(
  client: TodayClient,
  activities: TodayActivity[],
  transactions: TodayTransaction[],
  engagement: TodayEngagementEvent[] = []
): { score: number; reason: string } {
  // If client is closed, return cold with appropriate reason
  if (client.status === "closed") {
    return {
      score: 0,
      reason: "Closed"
    };
  }

  // Start with base score from deal stage
  let score = 0;
  switch (client.status) {
    case "new":
    case "contacted":
      score = 2;
      break;
    case "showing":
      score = 4;
      break;
    case "offer":
      score = 6;
      break;
    case "under_contract":
      score = 8;
      break;
    default:
      score = 1; // fallback for unknown status
  }

  // Get days since last contact
  const daysSinceLastContact = daysSinceContact(client.id, activities);

  // Adjust score based on recency of contact
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 1) {
      score += 2; // Very recent contact
    } else if (daysSinceLastContact <= 3) {
      score += 1; // Recent contact
    } else if (daysSinceLastContact <= 7) {
      // No change for week-old contact
    } else if (daysSinceLastContact <= 14) {
      score -= 1; // Getting stale
    } else {
      score -= 2; // Stale contact
    }
  }

  // Check for closing transaction and adjust score based on proximity
  const clientTransactions = transactions.filter(tx => tx.client_id === client.id);
  if (clientTransactions.length > 0) {
    // Find the most imminent closing
    const closingDates = clientTransactions
      .map(tx => tx.closing_date ? new Date(tx.closing_date) : null)
      .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

    if (closingDates.length > 0) {
      const soonestClosing = Math.min(...closingDates.map(d => d.getTime()));
      const daysUntilClosing = Math.ceil((soonestClosing - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilClosing <= 0) {
        // Closing today or already closed (should be handled by status, but just in case)
        score += 2;
      } else if (daysUntilClosing <= 3) {
        score += 2; // Closing very soon
      } else if (daysUntilClosing <= 7) {
        score += 1; // Closing soon
      }
      // No adjustment for further out closings
    }
  }

  // Adjust score based on activity momentum (last 14 days)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentActivities = activities.filter(activity =>
    new Date(activity.created_at) >= twoWeeksAgo
  );

  if (recentActivities.length >= 3) {
    score += 1; // High activity
  } else if (recentActivities.length === 0) {
    score -= 1; // No recent activity
  }

  // Engagement boost for high-intent activities
  const hasHighIntentActivity = activities.some(activity =>
    activity.type === "showing" || activity.type === "offer"
  );
  if (hasHighIntentActivity) {
    score += 1;
  }

  // ── Behavioral engagement (portal opens, views, favorites, inquiries) ──────
  // The real signal behind heat — what the client actually does, attributed via
  // their per-client portal. Recent windows: last 7 days vs the prior 7 days.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const myEng = engagement.filter((e) => e.client_id === client.id);
  const eng7 = myEng.filter((e) => nowMs - new Date(e.created_at).getTime() <= 7 * DAY_MS);
  const engPrev7 = myEng.filter((e) => {
    const d = nowMs - new Date(e.created_at).getTime();
    return d > 7 * DAY_MS && d <= 14 * DAY_MS;
  });
  const opens7 = eng7.filter((e) => e.event_type === "portal_open").length;
  const views7 = eng7.filter((e) => e.event_type === "view").length;
  const favs7 = eng7.filter((e) => e.event_type === "favorite").length;
  const inquiries7 = eng7.filter((e) => e.event_type === "inquiry").length;
  if (opens7 > 0) score += 1;
  if (views7 >= 1) score += 1;
  if (views7 >= 3) score += 1;
  if (favs7 >= 1) score += 2;
  if (inquiries7 >= 1) score += 3;
  // Rising momentum — engaging more this week than last.
  if (eng7.length >= 2 && eng7.length > engPrev7.length) score += 1;

  // Clamp score between 0 and 10
  score = Math.max(0, Math.min(10, Math.round(score)));

  // Generate reason string based on the most significant factors
  const reasonParts: string[] = [];

  // Add status-based reason
  const statusReasons: Record<string, string> = {
    "new": "New lead",
    "contacted": "Initial contact made",
    "showing": "Actively touring properties",
    "offer": "At offer stage",
    "under_contract": "Under contract"
  };
  if (client.status && statusReasons[client.status]) {
    reasonParts.push(statusReasons[client.status]);
  }

  // Add recency reason if significant
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact === 0) {
      reasonParts.push("Contacted today");
    } else if (daysSinceLastContact === 1) {
      reasonParts.push("Contacted yesterday");
    } else if (daysSinceLastContact >= 2 && daysSinceLastContact <= 7) {
      reasonParts.push(`Contacted ${daysSinceLastContact} days ago`);
    } else if (daysSinceLastContact > 7 && daysSinceLastContact <= 14) {
      reasonParts.push(`Contacted ${daysSinceLastContact} days ago`);
    } else if (daysSinceLastContact > 14) {
      reasonParts.push(`No contact in ${daysSinceLastContact} days`);
    }
  }

  // Add closing reason if imminent
  if (clientTransactions.length > 0) {
    const closingDates = clientTransactions
      .map(tx => tx.closing_date ? new Date(tx.closing_date) : null)
      .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

    if (closingDates.length > 0) {
      const soonestClosing = Math.min(...closingDates.map(d => d.getTime()));
      const daysUntilClosing = Math.ceil((soonestClosing - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilClosing === 0) {
        reasonParts.push("Closing today");
      } else if (daysUntilClosing === 1) {
        reasonParts.push("Closing tomorrow");
      } else if (daysUntilClosing >= 2 && daysUntilClosing <= 7) {
        reasonParts.push(`Closing in ${daysUntilClosing} days`);
      }
    }
  }

  // Add activity reason if significant
  if (recentActivities.length >= 3) {
    reasonParts.push("High recent activity");
  } else if (recentActivities.length === 0 && daysSinceLastContact !== null && daysSinceLastContact > 7) {
    reasonParts.push("No recent activity");
  }

  // Behavioral reason takes priority — it's the freshest, most actionable signal.
  let engReason: string | null = null;
  if (inquiries7 >= 1) engReason = "Asked about a listing this week";
  else if (favs7 >= 1) engReason = favs7 === 1 ? "Favorited a home this week" : `Favorited ${favs7} homes this week`;
  else if (views7 >= 3) engReason = `Viewed ${views7} listings this week`;
  else if (views7 >= 1) engReason = `Viewed ${views7} listing${views7 === 1 ? "" : "s"} this week`;
  else if (opens7 > 0) engReason = "Opened your portal this week";
  if (engReason) reasonParts.unshift(engReason);

  // Join reason parts, limiting to 2 most relevant for brevity
  const reason = reasonParts.slice(0, 2).join("; ") || "Lead scored";

  return { score, reason };
}

/**
 * Plain-English verb for an activity type + direction — the single source of
 * truth for both the per-card activity signal and the recent-activity feed.
 * Returns null for types that aren't a meaningful client-facing "signal"
 * (internal notes, automation runs) rather than inventing one.
 */
export function activityVerb(type: string | null, direction: string | null): string | null {
  const inbound = direction === "inbound";
  switch (type) {
    case "text":
      return inbound ? "Replied to your text" : "You texted";
    case "call":
      return "Phone call logged";
    case "email":
      return inbound ? "Replied to your email" : "You emailed";
    case "showing":
      return "Toured a property with you";
    case "offer":
      return "Submitted an offer";
    default:
      return null;
  }
}

/** Short, honest label for a client's most recent activity — built only from real logged rows, never invented. */
function mostRecentActivityLabel(clientId: string, activities: TodayActivity[]): string | null {
  const clientActivities = activities.filter((a) => a.client_id === clientId);
  if (clientActivities.length === 0) return null;
  const latest = clientActivities.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b,
  );
  const verb = activityVerb(latest.type, latest.direction);
  if (!verb) return null;

  const days = differenceInCalendarDays(new Date(), new Date(latest.created_at));
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `${verb} · ${when}`;
}

export function commissionFor(dealValue: number | null, commissionPct: number = 2.5): number | null {
  if (!dealValue) return null;
  return Math.round(dealValue * (commissionPct / 100));
}

/** Deal-stage baseline probability that a client's deal actually closes — the starting point before timing adjusts it. */
const STAGE_CLOSE_PROBABILITY: Record<string, number> = {
  new: 0.1,
  contacted: 0.15,
  showing: 0.3,
  offer: 0.5,
  under_contract: 0.85,
  closed: 1,
};

/**
 * Probability a deal closes, from deal stage plus how close the closing date
 * is — clients further along AND closing sooner are weighted higher, per
 * BUILD.md's "REAL MONEY NUMBERS" spec. Timing only ever raises the stage
 * baseline (a looming closing date is a positive signal, never negative).
 */
export function dealCloseProbability(status: string | null, closingDateIso: string | null): number {
  const base = STAGE_CLOSE_PROBABILITY[status ?? ""] ?? 0.1;
  if (!closingDateIso) return base;
  const days = differenceInCalendarDays(new Date(closingDateIso), new Date());
  if (days <= 0) return Math.max(base, 0.95);
  if (days <= 3) return Math.max(base, 0.92);
  if (days <= 7) return Math.max(base, 0.88);
  if (days <= 14) return Math.max(base, 0.82);
  return base;
}

/** Real deal value for a client: an active transaction's actual contract price beats the budget-based estimate. */
function realDealValue(
  clientId: string,
  budgetMax: number | null,
  transactions: TodayTransaction[],
): { value: number | null; isReal: boolean } {
  const withPrice = transactions.find(
    (t) => t.client_id === clientId && t.status !== "closed" && t.contract_price,
  );
  if (withPrice?.contract_price) return { value: withPrice.contract_price, isReal: true };
  return { value: budgetMax, isReal: false };
}

export type MoneyEstimate = {
  dealValue: number | null;
  dealValueIsReal: boolean;
  commissionPct: number;
  probability: number;
  /** Full commission if the deal closes — dealValue × commissionPct, not weighted by probability. */
  projectedCommission: number | null;
  /** Probability-weighted commission — the "real dollars at stake" figure for ranking and totals. */
  expectedCommission: number | null;
};

/**
 * Computes the real money figures for a client: real deal value (contract
 * price beats budget estimate), real commission rate (signed BBA beats the
 * 2.5% default), and a stage+timing-weighted probability of closing.
 */
export function computeMoneyEstimate(
  client: TodayClient,
  transactions: TodayTransaction[],
  commissionPctByClient: Map<string, number>,
): MoneyEstimate {
  const { value: dealValue, isReal: dealValueIsReal } = realDealValue(client.id, client.budget_max, transactions);
  const commissionPct = commissionPctByClient.get(client.id) ?? 2.5;

  const soonestClosing = transactions
    .filter((t) => t.client_id === client.id && t.closing_date)
    .map((t) => t.closing_date as string)
    .sort()[0] ?? null;
  const probability = dealCloseProbability(client.status, soonestClosing);

  const projectedCommission = commissionFor(dealValue, commissionPct);
  const expectedCommission = projectedCommission !== null ? Math.round(projectedCommission * probability) : null;

  return { dealValue, dealValueIsReal, commissionPct, probability, projectedCommission, expectedCommission };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Builds the urgency-sorted Today list from raw Supabase data.
 * Pure function — no I/O, easy to test. No cap — returns all qualifying items.
 *
 * Urgency rank:
 *   1  — transaction closing in ≤3 days
 *   2  — hot leads with no activity in 5+ days
 *   3  — birthdays / home purchase anniversaries today
 *   4  — pending signatures (no BBA)
 *   5  — new MLS matches for active buyers
 *   6  — likely to sell (propensity scaffold, BUILD.md P3 — stub data)
 */
export function buildTodayItems(
  clients: TodayClient[],
  transactions: TodayTransaction[],
  activities: TodayActivity[],
  newMatchItems: NewMatchItem[],
  bbaSignedClientIds: string[],
  engagement: TodayEngagementEvent[] = [],
  // Past (closed) clients — excluded from `clients` above since ranks 1-5 are
  // all active-buyer concerns. Propensity-to-sell (rank 6) is the opposite:
  // it only ever fires for closed clients, so it needs its own list.
  closedClients: TodayClient[] = [],
  // Real commission rate per client, keyed by client_id — from their signed
  // BBA. Clients without a signed agreement fall back to the 2.5% default
  // inside computeMoneyEstimate.
  bbaCommissionPctByClient: Map<string, number> = new Map(),
): TodayItem[] {
  const items: TodayItem[] = [];
  const now = new Date();

  // ── 1. At-risk transactions (closing ≤3 days) ─────────────────────────────
  for (const tx of transactions) {
    if (!tx.closing_date) continue;
    const days = differenceInCalendarDays(new Date(tx.closing_date), now);
    if (days < 0 || days > 3) continue;

    const client = clients.find((c) => c.id === tx.client_id);
    if (!client) continue;

    // reason identifies WHICH closing; timing pill ("TODAY"/"TOMORROW"/"2 DAYS") conveys urgency
    const reason = tx.address ? `Closing at ${tx.address}` : "Closing soon";

    // Compute real lead score for transaction items
    const { score: txScore, reason: txReason } = computeLeadScore(client, activities, transactions, engagement);

    items.push({
      id: `tx-${tx.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      leadScore: txScore,
      leadHeat: heatFromScore(txScore),
      leadScoreReason: txReason,
      activitySignal: mostRecentActivityLabel(client.id, activities),
      commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
      reason,
      context: client.town ?? null,
      actionLabel: closingLabel(client.name),
      actionType: "navigate",
      // Points at the rebuilt Client Detail page, not the old unrebuilt
      // /transactions/[id] "Transaction Copilot" screen — that screen is
      // deliberately off the design system pending a post-demo rebuild.
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 1,
      transactionId: tx.id,
    });
  }

  // ── 2. Hot leads quiet for 5+ days ────────────────────────────────────────
  for (const client of clients) {
    if (!isHot(client)) continue;
    if (items.some((i) => i.clientId === client.id)) continue;

    const days = daysSinceContact(client.id, activities);
    const isQuiet = days === null || days >= 5;
    if (!isQuiet) continue;

    const daysPhrase =
      days === null ? "You haven't reached out yet" : `Hasn't heard from you in ${days} days`;
    const budget = fmtBudget(client.budget_min, client.budget_max);

    // Compute real lead score for hot lead items
    const { score: hotScore, reason: hotReason } = computeLeadScore(client, activities, transactions, engagement);

    items.push({
      id: `hot-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      leadScore: hotScore,
      leadHeat: heatFromScore(hotScore),
      leadScoreReason: hotReason,
      activitySignal: mostRecentActivityLabel(client.id, activities),
      commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
      reason: daysPhrase,
      context: [client.town, budget].filter(Boolean).join(" · ") || null,
      actionLabel: `Text ${textRecipient(client.name)}`,
      actionType: "text",
      navigateTo: null,
      urgencyRank: 2,
    });
  }

  // ── 3. Birthdays & home purchase anniversaries today ──────────────────────
  // If BOTH fall today, home purchase anniversary takes priority.
  for (const client of clients) {
    if (client.status === "closed") continue;
    if (items.some((i) => i.clientId === client.id)) continue;

    const isBirthday = isAnniversaryToday(client.birthday);
    const isHomePurchase = isAnniversaryToday(client.home_purchase_date);
    if (!isBirthday && !isHomePurchase) continue;

    // Compute real lead score for anniversary items
    const { score: annivScore, reason: annivReason } = computeLeadScore(client, activities, transactions, engagement);

    if (isHomePurchase) {
      const purchaseYear = client.home_purchase_date
        ? new Date(client.home_purchase_date + "T00:00:00").getFullYear()
        : null;
      const yearsAgo = purchaseYear ? now.getFullYear() - purchaseYear : null;
      const yearLabel = yearsAgo ? ` — ${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago` : "";

      items.push({
        id: `anniv-${client.id}`,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientTown: client.town,
        clientBudgetMax: client.budget_max,
        clientStatus: client.status,
        leadScore: annivScore,
        leadHeat: heatFromScore(annivScore),
        leadScoreReason: annivReason,
        activitySignal: mostRecentActivityLabel(client.id, activities),
        commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
        reason: `Home purchase anniversary${yearLabel}`,
        context: client.town ?? null,
        actionLabel: `Send anniversary text to ${textRecipient(client.name)}`,
        actionType: "text",
        navigateTo: null,
        urgencyRank: 3,
      });
    } else {
      items.push({
        id: `bday-${client.id}`,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientTown: client.town,
        clientBudgetMax: client.budget_max,
        clientStatus: client.status,
        leadScore: annivScore,
        leadHeat: heatFromScore(annivScore),
        leadScoreReason: annivReason,
        activitySignal: mostRecentActivityLabel(client.id, activities),
        commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
        reason: "Today is their birthday",
        context: client.town ?? null,
        actionLabel: `Send birthday text to ${textRecipient(client.name)}`,
        actionType: "text",
        navigateTo: null,
        urgencyRank: 3,
      });
    }
  }

  // ── 4. Pending signatures (no BBA) — cap at 3 to avoid flooding ─────────
  let bbaCount = 0;
  for (const client of clients) {
    if (bbaCount >= 3) break;
    if (client.status === "closed") continue;
    if (items.some((i) => i.clientId === client.id)) continue;
    if (bbaSignedClientIds.includes(client.id)) continue;
    if (!ACTIVE_BUYER_STATUSES.includes(client.status ?? "")) continue;

    // Compute real lead score for BBA items
    const { score: bbaScore, reason: bbaReason } = computeLeadScore(client, activities, transactions, engagement);

    bbaCount++;
    items.push({
      id: `bba-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      leadScore: bbaScore,
      leadHeat: heatFromScore(bbaScore),
      leadScoreReason: bbaReason,
      activitySignal: mostRecentActivityLabel(client.id, activities),
      commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
      reason: "Hasn't signed the buyer agreement yet",
      context: client.town ?? null,
      actionLabel: `Remind ${client.name.split(" ")[0]} to sign`,
      actionType: "navigate",
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 4,
    });
  }

  // ── 5. New MLS matches — active buyers only ───────────────────────────────
  for (const { clientId, propertyAddress } of newMatchItems) {
    if (items.some((i) => i.clientId === clientId)) continue;
    const client = clients.find((c) => c.id === clientId);
    if (!client) continue;
    if (!ACTIVE_BUYER_STATUSES.includes(client.status ?? "")) continue;

    // Compute real lead score for MLS match items
    const { score: matchScore, reason: matchReason } = computeLeadScore(client, activities, transactions, engagement);

    const budget = fmtBudget(client.budget_min, client.budget_max);
    const firstName = client.name.split(" ")[0];
    const addrLabel = propertyAddress
      ? `Send ${propertyAddress} to ${firstName}`
      : `Send new listing to ${firstName}`;

    items.push({
      id: `match-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      leadScore: matchScore,
      leadHeat: heatFromScore(matchScore),
      leadScoreReason: matchReason,
      activitySignal: mostRecentActivityLabel(client.id, activities),
      commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
      reason: "New listing just hit MLS that fits what they want",
      context: [client.town, budget].filter(Boolean).join(" · ") || null,
      actionLabel: addrLabel,
      actionType: "navigate",
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 5,
      propertyAddress: propertyAddress ?? null,
    });
  }

  // ── 6. Likely to sell — propensity scaffold (BUILD.md P3) ─────────────────
  // Stub-scored from years-since-purchase/status/budget (see
  // lib/ai/seller-propensity.ts) — a placeholder for a real behavioral/AVM
  // model. Capped at 3 like the BBA list above.
  let propensityCount = 0;
  for (const client of closedClients) {
    if (propensityCount >= 3) break;
    if (items.some((i) => i.clientId === client.id)) continue;

    const propensity = sellerPropensity(client);
    if (propensity.band !== "high") continue;

    propensityCount++;
    const firstName = client.name.split(" ")[0];
    const reason = propensity.reasons[0] ?? "Shows signs of being ready to sell";

    items.push({
      id: `propensity-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      // Mapped onto the same 0-10 scale as buyer lead heat so the existing
      // heat-dot rendering stays meaningful without a UI change — high
      // propensity reads visually "hot" same as a hot buyer lead.
      leadScore: Math.round(propensity.score / 10),
      leadHeat: heatFromScore(Math.round(propensity.score / 10)),
      leadScoreReason: propensity.reasons.join("; ") || null,
      activitySignal: mostRecentActivityLabel(client.id, activities),
      commissionEst: computeMoneyEstimate(client, transactions, bbaCommissionPctByClient).expectedCommission,
      reason,
      context: client.town ?? null,
      actionLabel: `Check in with ${firstName}`,
      actionType: "text",
      navigateTo: null,
      urgencyRank: 6,
    });
  }

  // ── Sort by urgency, return all items (no cap) ────────────────────────────
  items.sort((a, b) => a.urgencyRank - b.urgencyRank);
  return items;
}
