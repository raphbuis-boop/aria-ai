// Propensity-to-sell — BUILD.md P3 (scaffold only).
//
// Flags people in the agent's own sphere who are plausible sellers before
// they've said so, using data we already have. This is deliberately a
// placeholder: real propensity/AVM signal (deed records, equity, life-event
// data broker feeds — Cotality-class) needs a paid provider, which is a
// separate business decision (out of scope here, see BUILD.md P3).
//
// The seam: everything downstream (lib/today-items.ts, the UI) only ever
// sees { score, band, reasons }. Swapping the stub body below for a real
// provider call — gated on PROPENSITY_PROVIDER — changes nothing else.

export type PropensityBand = "high" | "watch" | "low";

export type SellerPropensity = {
  /** 0–100. Stub score today; a real provider would return its own scale
   *  clamped into this same range so callers never have to change. */
  score: number;
  band: PropensityBand;
  /** Plain-English factors behind the score, most significant first. */
  reasons: string[];
};

/** The minimal client shape the stub scorer needs — a subset of TodayClient. */
export type PropensityClient = {
  id: string;
  status: string | null;
  home_purchase_date: string | null;
  budget_max: number | null;
};

// Env-gated seam for a future paid propensity/AVM feed. Unset in every
// environment today — there is no provider integration behind this, only
// the flag itself, so flipping it on does nothing until one is built.
const PROPENSITY_PROVIDER = process.env.PROPENSITY_PROVIDER ?? null;

const HIGH_THRESHOLD = 65;
const WATCH_THRESHOLD = 40;

function bandFromScore(score: number): PropensityBand {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= WATCH_THRESHOLD) return "watch";
  return "low";
}

function yearsSincePurchase(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  return (Date.now() - d.getTime()) / MS_PER_YEAR;
}

/**
 * Stub propensity-to-sell score computed from years-since-purchase, status,
 * and budget — a placeholder standing in for a real behavioral/AVM model.
 * Swappable without touching any caller: this function's signature and
 * return shape are the only contract.
 */
export function sellerPropensity(client: PropensityClient): SellerPropensity {
  if (PROPENSITY_PROVIDER) {
    // A real paid feed would be called here instead of the heuristic below.
    // Not built — see BUILD.md P3 "out of scope". Falls through to the stub
    // so setting the env var alone never silently changes behavior.
  }

  const years = yearsSincePurchase(client.home_purchase_date);
  if (years == null || client.status !== "closed") {
    // No purchase date, or not a past client of record — nothing to base a
    // resale signal on yet.
    return { score: 0, band: "low", reasons: [] };
  }

  const reasons: string[] = ["Past client — relationship already established"];

  // Every past client with a purchase date on file is at least a plausible
  // future seller; tenure in the classic move-up window pushes it further.
  let score = 50;
  const wholeYears = Math.round(years);
  if (years >= 5 && years <= 9) {
    score += 20;
    reasons.unshift(`Bought ${wholeYears} years ago — classic move-up window`);
  } else if (years > 9 && years <= 15) {
    score += 10;
    reasons.unshift(`Bought ${wholeYears} years ago`);
  } else if (years >= 2 && years < 5) {
    score += 5;
    reasons.unshift(`Bought ${wholeYears} years ago`);
  } else if (years > 15) {
    reasons.unshift(`Bought ${wholeYears} years ago — long tenure`);
  }

  // Budget still on file suggests continued market engagement.
  if (client.budget_max != null && client.budget_max > 0) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, band: bandFromScore(score), reasons: reasons.slice(0, 2) };
}
