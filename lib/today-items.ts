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
  birthday: string | null;           // DATE column added in migration
  home_purchase_date: string | null; // DATE column added in migration
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
};

// ─── Output type ─────────────────────────────────────────────────────────────

export type ActionType = "text" | "navigate";

export type TodayItem = {
  id: string;          // unique key for React
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientTown: string | null;
  clientBudgetMax: number | null;
  clientStatus: string | null;
  reason: string;      // plain English — shown to user
  context: string | null; // second muted line, optional
  actionLabel: string; // text on the big button
  actionType: ActionType;
  navigateTo: string | null; // used when actionType === "navigate"
  urgencyRank: number; // lower = higher urgency (for sort)
};

export type TodayResult = {
  items: TodayItem[];
  overflowCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHot(c: TodayClient): boolean {
  if (c.status === "under_contract" || c.status === "closed") return false;
  return c.status === "showing" || (c.lead_score ?? 0) >= 8;
}

// Statuses that represent an actively searching buyer
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

/** Returns true if a DATE string (YYYY-MM-DD) falls on today's month/day. */
function isAnniversaryToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00"); // avoid UTC shift
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

/** Days since the most recent activity for a client. Returns null if no activity. */
function daysSinceContact(
  clientId: string,
  activities: TodayActivity[],
): number | null {
  const clientActivities = activities.filter((a) => a.client_id === clientId);
  if (clientActivities.length === 0) return null;
  const latest = clientActivities.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b,
  );
  return differenceInCalendarDays(new Date(), new Date(latest.created_at));
}

// ─── Main export ─────────────────────────────────────────────────────────────

const MAX_ITEMS = 7;

/**
 * Builds the sorted, capped Today list from raw Supabase data.
 * Pure function — no I/O, easy to test.
 *
 * Urgency rank:
 *   1  — transaction closing/contingency in ≤3 days
 *   2  — hot leads with no activity in 5+ days
 *   3  — birthdays / home purchase anniversaries today
 *   4  — pending signatures (no BBA)
 *   5  — new MLS matches for active buyers
 */
export function buildTodayItems(
  clients: TodayClient[],
  transactions: TodayTransaction[],
  activities: TodayActivity[],
  newMatchClientIds: string[],  // client IDs with unnotified matches
  bbaSignedClientIds: string[], // client IDs who have already signed a BBA
): TodayResult {
  const items: TodayItem[] = [];
  const now = new Date();

  // ── 1. At-risk transactions (closing/contingency ≤3 days) ─────────────────
  for (const tx of transactions) {
    if (!tx.closing_date) continue;
    const days = differenceInCalendarDays(new Date(tx.closing_date), now);
    if (days < 0 || days > 3) continue;

    const client = clients.find((c) => c.id === tx.client_id);
    if (!client) continue;

    const daysLabel =
      days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const addr = tx.address ? ` at ${tx.address}` : "";

    items.push({
      id: `tx-${tx.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      reason: `Closing${addr} is ${daysLabel} — check in now`,
      context: client.town ?? null,
      actionLabel: `Open ${client.name.split(" ")[0]}'s deal`,
      actionType: "navigate",
      navigateTo: `/transactions`,
      urgencyRank: 1,
    });
  }

  // ── 2. Hot leads quiet for 5+ days ────────────────────────────────────────
  for (const client of clients) {
    if (!isHot(client)) continue;
    if (client.status === "closed") continue;
    if (items.some((i) => i.clientId === client.id)) continue;

    const days = daysSinceContact(client.id, activities);
    const isQuiet = days === null || days >= 5;
    if (!isQuiet) continue;

    const daysPhrase =
      days === null ? "You haven't reached out yet" : `Hasn't heard from you in ${days} days`;
    const budget = fmtBudget(client.budget_min, client.budget_max);

    items.push({
      id: `hot-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      reason: daysPhrase,
      context: [client.town, budget].filter(Boolean).join(" · ") || null,
      actionLabel: `Text ${client.name.split(" ")[0]} now`,
      actionType: "text",
      navigateTo: null,
      urgencyRank: 2,
    });
  }

  // ── 3. Birthdays & home purchase anniversaries today ──────────────────────
  // Fix: if BOTH birthday and home purchase anniversary fall today,
  // prefer home purchase anniversary (more meaningful in a real estate relationship).
  for (const client of clients) {
    if (client.status === "closed") continue;
    if (items.some((i) => i.clientId === client.id)) continue;

    const isBirthday = isAnniversaryToday(client.birthday);
    const isHomePurchase = isAnniversaryToday(client.home_purchase_date);
    if (!isBirthday && !isHomePurchase) continue;

    if (isHomePurchase) {
      // Home purchase anniversary takes priority over birthday
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
        reason: `Home purchase anniversary${yearLabel}`,
        context: client.town ?? null,
        actionLabel: `Send anniversary text`,
        actionType: "text",
        navigateTo: null,
        urgencyRank: 3,
      });
    } else {
      // Birthday only (no home purchase anniversary today)
      items.push({
        id: `bday-${client.id}`,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientTown: client.town,
        clientBudgetMax: client.budget_max,
        clientStatus: client.status,
        reason: "Today is their birthday",
        context: client.town ?? null,
        actionLabel: `Send birthday text`,
        actionType: "text",
        navigateTo: null,
        urgencyRank: 3,
      });
    }
  }

  // ── 4. Pending signatures (no BBA) ────────────────────────────────────────
  for (const client of clients) {
    if (client.status === "closed") continue;
    if (items.some((i) => i.clientId === client.id)) continue;
    if (bbaSignedClientIds.includes(client.id)) continue;
    if (!ACTIVE_BUYER_STATUSES.includes(client.status ?? "")) continue;

    items.push({
      id: `bba-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      reason: "Hasn't signed the buyer agreement yet",
      context: client.town ?? null,
      actionLabel: `Remind ${client.name.split(" ")[0]} to sign`,
      actionType: "navigate",
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 4,
    });
  }

  // ── 5. New MLS matches — active buyers only ───────────────────────────────
  for (const clientId of newMatchClientIds) {
    if (items.some((i) => i.clientId === clientId)) continue;
    const client = clients.find((c) => c.id === clientId);
    if (!client) continue;
    // Only surface matches for clients actively searching
    if (!ACTIVE_BUYER_STATUSES.includes(client.status ?? "")) continue;

    const budget = fmtBudget(client.budget_min, client.budget_max);

    items.push({
      id: `match-${client.id}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientTown: client.town,
      clientBudgetMax: client.budget_max,
      clientStatus: client.status,
      reason: "New listing just hit MLS that fits what they want",
      context: [client.town, budget].filter(Boolean).join(" · ") || null,
      actionLabel: `Send listing to ${client.name.split(" ")[0]}`,
      actionType: "navigate",
      navigateTo: `/clients/${client.id}`,
      urgencyRank: 5,
    });
  }

  // ── Sort by urgency, cap at MAX_ITEMS, return overflow count ──────────────
  items.sort((a, b) => a.urgencyRank - b.urgencyRank);
  const overflowCount = Math.max(0, items.length - MAX_ITEMS);
  return {
    items: items.slice(0, MAX_ITEMS),
    overflowCount,
  };
}
