import { differenceInCalendarDays } from "date-fns";

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
  /** Projected commission at 2.5% of budget max — same convention used elsewhere in the app. Null when no budget on file. */
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
  transactions: TodayTransaction[]
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

export function commissionFor(budgetMax: number | null): number | null {
  if (!budgetMax) return null;
  return Math.round(budgetMax * 0.025);
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
 */
export function buildTodayItems(
  clients: TodayClient[],
  transactions: TodayTransaction[],
  activities: TodayActivity[],
  newMatchItems: NewMatchItem[],
  bbaSignedClientIds: string[],
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
    const { score: txScore, reason: txReason } = computeLeadScore(client, activities, transactions);

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
      commissionEst: commissionFor(client.budget_max),
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
    const { score: hotScore, reason: hotReason } = computeLeadScore(client, activities, transactions);

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
      commissionEst: commissionFor(client.budget_max),
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
    const { score: annivScore, reason: annivReason } = computeLeadScore(client, activities, transactions);

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
        commissionEst: commissionFor(client.budget_max),
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
        commissionEst: commissionFor(client.budget_max),
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
    const { score: bbaScore, reason: bbaReason } = computeLeadScore(client, activities, transactions);

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
      commissionEst: commissionFor(client.budget_max),
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
    const { score: matchScore, reason: matchReason } = computeLeadScore(client, activities, transactions);

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
      commissionEst: commissionFor(client.budget_max),
      reason: "New listing just hit MLS that fits what they want",
      context: [client.town, budget].filter(Boolean).join(" · ") || null,
      actionLabel: addrLabel,
      actionType: "navigate",
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 5,
      propertyAddress: propertyAddress ?? null,
    });
  }

  // ── Sort by urgency, return all items (no cap) ────────────────────────────
  items.sort((a, b) => a.urgencyRank - b.urgencyRank);
  return items;
}
