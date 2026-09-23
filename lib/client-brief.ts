import { differenceInCalendarDays } from "date-fns";
import { commissionFor } from "./today-items";

// ─── Input types ─────────────────────────────────────────────────────────────

export type BriefClient = {
  name: string;
  phone: string | null;
  status: string | null;
  clientRole: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  town: string | null;
  leadScore: number | null;
};

export type BriefActivity = {
  type: string | null;
  direction: string | null;
  created_at: string;
};

export type BriefTransaction = {
  id: string;
  status: string | null;
  closing_date: string | null;
  contract_price: number | null;
};

export type BriefMatch = {
  created_at: string;
  notified: boolean;
};

// ─── Output type ─────────────────────────────────────────────────────────────

export type PrimaryActionType = "text" | "call";

export type ClientBrief = {
  /** Real contract price if under contract, else an estimate off budget_max. Null if neither exists. */
  dealValue: number | null;
  dealValueLabel: "Under contract" | "Est. deal value" | null;
  commissionEst: number | null;
  /** One or two plain-English sentences: where things stand + the recommended next move. */
  briefing: string;
  primaryActionLabel: string;
  primaryActionType: PrimaryActionType;
  daysSinceContact: number | null;
  activeTransaction: BriefTransaction | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstNameOf(name: string): string {
  return name.split(" ")[0];
}

function daysSinceContact(activities: BriefActivity[]): number | null {
  if (activities.length === 0) return null;
  const latest = activities.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
  return differenceInCalendarDays(new Date(), new Date(latest.created_at));
}

/** "today" / "tomorrow" / "Thursday" / "Sep 12" depending on how far out. */
function closingPhrase(closingDateIso: string): string {
  const d = new Date(closingDateIso);
  const days = differenceInCalendarDays(d, new Date());
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 6) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function contactPhrase(days: number | null): string {
  if (days === null) return "hasn't been contacted yet";
  if (days === 0) return "was contacted today";
  if (days === 1) return "was last contacted yesterday";
  return `hasn't been contacted in ${days} days`;
}

export const CLIENT_STATUSES = [
  { value: "new", label: "New lead" },
  { value: "contacted", label: "Contacted" },
  { value: "showing", label: "Touring" },
  { value: "offer", label: "Offer" },
  { value: "under_contract", label: "Under contract" },
  { value: "closed", label: "Closed" },
] as const;

/** Short chip label for clients.status ("New lead", "Touring"…). */
export function statusShortLabel(status: string | null): string {
  return CLIENT_STATUSES.find((s) => s.value === status)?.label ?? "Active";
}

export function statusLabel(status: string | null): string {
  switch (status) {
    case "new": return "a new lead";
    case "contacted": return "in early conversation";
    case "showing": return "actively touring";
    case "offer": return "at offer stage";
    case "under_contract": return "under contract";
    case "closed": return "closed";
    default: return "on your radar";
  }
}

function isHotOrWarm(status: string | null, leadScore: number | null): boolean {
  if (status === "under_contract" || status === "closed") return false;
  return status === "showing" || (leadScore ?? 0) >= 5;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Builds the money figure + Aria briefing sentence + recommended primary
 * action for a single client's detail screen. Pure function — no I/O.
 * Deterministic/rule-based (same convention as lib/today-items.ts's plain-
 * English reasons) rather than a live model call, so it's fast, free, and
 * reliable for every page load; swapping in a real Claude-generated
 * sentence later is a drop-in replacement at the call site.
 */
export function buildClientBrief(
  client: BriefClient,
  activities: BriefActivity[],
  transactions: BriefTransaction[],
  matches: BriefMatch[],
  // Real commission rate from the client's signed BBA. Falls back to the
  // 2.5% default (inside commissionFor) when they haven't signed one yet.
  commissionPct: number | null = null,
): ClientBrief {
  const firstName = firstNameOf(client.name);
  const days = daysSinceContact(activities);
  const quiet = days === null || days >= 3;

  const activeTransaction =
    transactions
      .filter((t) => t.status === "active")
      .sort((a, b) => {
        if (!a.closing_date) return 1;
        if (!b.closing_date) return -1;
        return new Date(a.closing_date).getTime() - new Date(b.closing_date).getTime();
      })[0] ?? null;

  const newMatchCount = matches.filter((m) => !m.notified).length;

  // ── Deal value + commission ──────────────────────────────────────────────
  let dealValue: number | null = null;
  let dealValueLabel: ClientBrief["dealValueLabel"] = null;
  if (activeTransaction?.contract_price) {
    dealValue = activeTransaction.contract_price;
    dealValueLabel = "Under contract";
  } else if (client.budgetMax) {
    dealValue = client.budgetMax;
    dealValueLabel = "Est. deal value";
  }
  const commissionEst = commissionFor(dealValue, commissionPct ?? undefined);

  // ── Briefing + primary action ────────────────────────────────────────────
  let briefing: string;
  let primaryActionLabel = `Text ${firstName}`;
  const primaryActionType: PrimaryActionType = client.phone ? "text" : "call";

  if (activeTransaction) {
    const closingDate = activeTransaction.closing_date;
    const closingSoon = closingDate ? differenceInCalendarDays(new Date(closingDate), new Date()) <= 5 : false;

    if (closingDate && closingSoon && quiet) {
      briefing = `${firstName} is closing ${closingPhrase(closingDate)} and ${contactPhrase(days)} — reach out today to keep the deal warm.`;
    } else if (closingDate && closingSoon) {
      briefing = `${firstName} is closing ${closingPhrase(closingDate)} and everything's on track. No urgent action right now.`;
      primaryActionLabel = `Check in with ${firstName}`;
    } else if (closingDate) {
      briefing = `${firstName}'s deal is under contract, closing ${closingPhrase(closingDate)} — check in on paperwork and next milestones.`;
    } else {
      briefing = `${firstName}'s deal is under contract — check in on paperwork and next milestones.`;
    }
  } else if (newMatchCount > 0 && quiet) {
    briefing = `${newMatchCount} new listing${newMatchCount === 1 ? "" : "s"} just matched what ${firstName} is looking for, and ${contactPhrase(days)} — send them over today.`;
  } else if (isHotOrWarm(client.status, client.leadScore) && quiet) {
    briefing = `${firstName} is a hot lead who's gone quiet — ${contactPhrase(days)}. Reach out before they cool off.`;
  } else if (days === null && (client.status === "new" || client.status === "contacted")) {
    briefing = `${firstName} just came in and hasn't heard from you yet — a quick intro goes a long way.`;
  } else if (quiet && days !== null && days >= 7) {
    briefing = `${firstName} hasn't heard from you in ${days} days. A quick check-in keeps things moving.`;
  } else {
    briefing = `${firstName} is ${statusLabel(client.status)} and things look steady. No urgent action needed right now.`;
    primaryActionLabel = `Check in with ${firstName}`;
  }

  return {
    dealValue,
    dealValueLabel,
    commissionEst,
    briefing,
    primaryActionLabel,
    primaryActionType,
    daysSinceContact: days,
    activeTransaction,
  };
}
