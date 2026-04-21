import {
  getAdjacentTowns,
  isTownAdjacentOrEqual,
  normalizeTown,
} from "@/lib/nj-towns";

/** Minimum total score (0-100) for a match to surface. */
export const MATCH_MIN_SCORE = 60;

export type MatchClient = {
  id: string;
  name?: string | null;
  status?: string | null;
  town?: string | null;
  preferred_towns?: string[] | null;
  nearby_towns_ok?: boolean | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_flex_pct?: number | null;
  beds_wanted?: number | null;
  bed_flex?: number | null;
  baths_wanted?: number | null;
  bath_flex?: number | null;
};

export type MatchProperty = {
  id: string;
  price?: number | null;
  town?: string | null;
  beds?: number | null;
  baths?: number | null;
};

export type MatchComponent = "town" | "budget" | "beds" | "baths";

export type MatchReason = {
  component: MatchComponent;
  /** 0..100 per-component score */
  score: number;
  /** Human-readable explanation shown on the card. */
  reason: string;
  /** Whether this component qualifies as an ideal/strong match (for pill UI). */
  strong: boolean;
};

export type MatchResult = {
  score: number; // 0..100 total, weighted
  reasons: MatchReason[];
  /** True if all four components individually passed their gates. */
  hardPass: boolean;
};

const WEIGHTS: Record<MatchComponent, number> = {
  town: 35,
  budget: 35,
  beds: 20,
  baths: 10,
};

/**
 * Return list of "effective" preferred towns — preferred_towns if present,
 * otherwise [town] so we always have something to match against.
 */
function effectivePreferredTowns(client: MatchClient): string[] {
  const list =
    client.preferred_towns?.filter((t): t is string => !!t && t.length > 0) ??
    [];
  if (list.length) return list;
  return client.town ? [client.town] : [];
}

/**
 * Town match: 100 if the property town exactly matches any preferred town;
 * 70 if `nearby_towns_ok` and the property town is adjacent to any preferred
 * town; 0 otherwise.
 */
function scoreTown(
  client: MatchClient,
  property: MatchProperty,
): { score: number; reason: string; strong: boolean } {
  const preferred = effectivePreferredTowns(client);
  if (!preferred.length || !property.town) {
    return { score: 0, reason: "town unknown", strong: false };
  }

  const pTown = normalizeTown(property.town);
  if (preferred.some((t) => normalizeTown(t) === pTown)) {
    return { score: 100, reason: "preferred town", strong: true };
  }

  if (client.nearby_towns_ok) {
    if (preferred.some((t) => isTownAdjacentOrEqual(t, property.town))) {
      return {
        score: 70,
        reason: `adjacent to ${preferred[0]}`,
        strong: false,
      };
    }
  }

  return { score: 0, reason: "outside preferred area", strong: false };
}

/**
 * Budget match — returns 0..100 based on where the listing price sits inside
 * the (flex-expanded) budget window. Ideal = inside original [min, max]; flex
 * window extends on both sides by `budget_flex_pct`. Outside the flex window
 * scores 0.
 */
function scoreBudget(
  client: MatchClient,
  property: MatchProperty,
): { score: number; reason: string; strong: boolean } {
  const price = property.price ?? 0;
  const min = client.budget_min ?? 0;
  const max = client.budget_max ?? 0;
  if (!price || (!min && !max)) {
    return { score: 0, reason: "budget unknown", strong: false };
  }

  const flexPct = Math.max(0, Number(client.budget_flex_pct ?? 10));
  const flex = flexPct / 100;

  const lowerHard = min ? min * (1 - flex) : 0;
  const upperHard = max ? max * (1 + flex) : Number.POSITIVE_INFINITY;

  if (price >= (min || 0) && (!max || price <= max)) {
    return { score: 100, reason: "within budget", strong: true };
  }

  if (price < lowerHard || price > upperHard) {
    return { score: 0, reason: "outside budget", strong: false };
  }

  // In the flex band — score drops linearly from 80 at the edge of the ideal
  // band to 40 at the flex boundary.
  if (max && price > max) {
    const over = (price - max) / Math.max(1, max * flex);
    const s = Math.max(40, 80 - over * 40);
    return {
      score: Math.round(s),
      reason: `~${Math.round((price / max - 1) * 100)}% over budget`,
      strong: false,
    };
  }
  if (min && price < min) {
    const under = (min - price) / Math.max(1, min * flex);
    const s = Math.max(40, 80 - under * 40);
    return {
      score: Math.round(s),
      reason: `~${Math.round((1 - price / min) * 100)}% under budget`,
      strong: false,
    };
  }

  return { score: 60, reason: "near budget", strong: false };
}

function scoreBeds(
  client: MatchClient,
  property: MatchProperty,
): { score: number; reason: string; strong: boolean } {
  const want = Number(client.beds_wanted ?? 0);
  const have = Number(property.beds ?? 0);
  if (!want) return { score: 60, reason: "beds flexible", strong: false };
  const flex = Math.max(0, Number(client.bed_flex ?? 1));
  const diff = Math.abs(have - want);

  if (have >= want) return { score: 100, reason: "beds ✓", strong: true };
  if (diff <= flex) {
    const s = 100 - (diff / Math.max(1, flex)) * 50;
    return {
      score: Math.round(Math.max(50, s)),
      reason: `${have}bd (wants ${want})`,
      strong: false,
    };
  }
  return { score: 0, reason: "not enough beds", strong: false };
}

function scoreBaths(
  client: MatchClient,
  property: MatchProperty,
): { score: number; reason: string; strong: boolean } {
  const want = Number(client.baths_wanted ?? 0);
  const have = Number(property.baths ?? 0);
  if (!want) return { score: 60, reason: "baths flexible", strong: false };
  const flex = Math.max(0, Number(client.bath_flex ?? 0.5));
  const diff = Math.abs(have - want);

  if (have >= want) return { score: 100, reason: "baths ✓", strong: true };
  if (diff <= flex + 1e-9) {
    return {
      score: 70,
      reason: `${have}ba (wants ${want})`,
      strong: false,
    };
  }
  return { score: 0, reason: "not enough baths", strong: false };
}

/**
 * Main scorer. Returns a weighted total 0..100 and per-component reasons.
 * `hardPass` is true iff every component scored > 0 (i.e. nothing falls
 * entirely outside its flex window).
 */
export function scoreFuzzyMatch(
  client: MatchClient,
  property: MatchProperty,
): MatchResult {
  const town = scoreTown(client, property);
  const budget = scoreBudget(client, property);
  const beds = scoreBeds(client, property);
  const baths = scoreBaths(client, property);

  const weighted =
    (town.score * WEIGHTS.town +
      budget.score * WEIGHTS.budget +
      beds.score * WEIGHTS.beds +
      baths.score * WEIGHTS.baths) /
    100;

  const reasons: MatchReason[] = [
    { component: "town", ...town },
    { component: "budget", ...budget },
    { component: "beds", ...beds },
    { component: "baths", ...baths },
  ];

  const hardPass =
    town.score > 0 && budget.score > 0 && beds.score > 0 && baths.score > 0;

  return {
    score: Math.round(weighted),
    reasons,
    hardPass,
  };
}

/**
 * Helper: short badge reasons (skipping zero-score components), for UI cards.
 */
export function matchBadgeReasons(result: MatchResult): string[] {
  return result.reasons
    .filter((r) => r.score > 0)
    .map((r) => r.reason);
}

// Re-export for convenience so callers can do `import { getAdjacentTowns } from "@/lib/matching"`.
export { getAdjacentTowns, isTownAdjacentOrEqual, normalizeTown };
