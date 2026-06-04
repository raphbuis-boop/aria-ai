/**
 * Regression: MatchingService must produce IDENTICAL scores to lib/matching.ts
 *
 * This test is the moat guard. If someone changes WEIGHTS or scoring logic in
 * lib/matching.ts, these tests will fail and force a conscious decision.
 * If someone accidentally re-implements scoring in MatchingService, the
 * parity check will also fail.
 */

import { describe, it, expect } from "vitest";
import { scoreFuzzyMatch, MATCH_MIN_SCORE } from "@/lib/matching";
import { MatchingService } from "@/lib/services/matching.service";
import type { MatchClient, MatchProperty } from "@/lib/matching";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const perfectClient: MatchClient = {
  id: "c-1",
  name: "Jane Smith",
  status: "active",
  town: "Montclair",
  preferred_towns: ["Montclair"],
  nearby_towns_ok: false,
  budget_min: 500_000,
  budget_max: 700_000,
  budget_flex_pct: 10,
  beds_wanted: 3,
  bed_flex: 1,
  baths_wanted: 2,
  bath_flex: 0.5,
};

const perfectProperty: MatchProperty = {
  id: "p-1",
  price: 600_000,
  town: "Montclair",
  beds: 3,
  baths: 2,
};

const flexBudgetProperty: MatchProperty = {
  id: "p-2",
  price: 730_000, // 4.3% over max — inside flex window
  town: "Montclair",
  beds: 3,
  baths: 2,
};

const adjacentTownClient: MatchClient = {
  ...perfectClient,
  id: "c-2",
  nearby_towns_ok: true,
  preferred_towns: ["Montclair"],
};

const adjacentTownProperty: MatchProperty = {
  id: "p-3",
  price: 600_000,
  town: "Glen Ridge", // adjacent to Montclair in nj-towns graph
  beds: 3,
  baths: 2,
};

const mismatchClient: MatchClient = {
  id: "c-3",
  name: "Bob Jones",
  status: "active",
  town: "Hoboken",
  preferred_towns: ["Hoboken"],
  nearby_towns_ok: false,
  budget_min: 400_000,
  budget_max: 500_000,
  budget_flex_pct: 5,
  beds_wanted: 4,
  bed_flex: 0,
  baths_wanted: 3,
  bath_flex: 0,
};

const mismatchProperty: MatchProperty = {
  id: "p-4",
  price: 800_000, // way over budget
  town: "Montclair", // wrong town
  beds: 2, // not enough beds, no flex
  baths: 1.5,
};

const flexBedsClient: MatchClient = {
  id: "c-4",
  preferred_towns: ["Summit"],
  nearby_towns_ok: false,
  budget_min: 600_000,
  budget_max: 800_000,
  budget_flex_pct: 10,
  beds_wanted: 4,
  bed_flex: 1,
  baths_wanted: 2,
  bath_flex: 0.5,
};

const flexBedsProperty: MatchProperty = {
  id: "p-5",
  price: 700_000,
  town: "Summit",
  beds: 3, // 1 under wanted, within bed_flex=1
  baths: 2,
};

const noPreferencesClient: MatchClient = {
  id: "c-5",
  // no town, no budget, no beds/baths set
};

const anyProperty: MatchProperty = {
  id: "p-6",
  price: 500_000,
  town: "Maplewood",
  beds: 3,
  baths: 2,
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("MatchingService parity with lib/matching.ts", () => {
  it("perfect match: service score === raw score", () => {
    const raw = scoreFuzzyMatch(perfectClient, perfectProperty);
    const svc = MatchingService.score(perfectClient, perfectProperty);
    expect(svc.score).toBe(raw.score);
    expect(svc.hardPass).toBe(raw.hardPass);
    expect(svc.reasons).toEqual(raw.reasons);
  });

  it("perfect match produces 100", () => {
    const result = MatchingService.score(perfectClient, perfectProperty);
    expect(result.score).toBe(100);
    expect(result.hardPass).toBe(true);
  });

  it("flex-budget property: service score === raw score", () => {
    const raw = scoreFuzzyMatch(perfectClient, flexBudgetProperty);
    const svc = MatchingService.score(perfectClient, flexBudgetProperty);
    expect(svc.score).toBe(raw.score);
    expect(svc.hardPass).toBe(raw.hardPass);
  });

  it("flex-budget score is < 100 but >= MATCH_MIN_SCORE", () => {
    const result = MatchingService.score(perfectClient, flexBudgetProperty);
    expect(result.score).toBeGreaterThanOrEqual(MATCH_MIN_SCORE);
    expect(result.score).toBeLessThan(100);
  });

  it("adjacent town: service score === raw score", () => {
    const raw = scoreFuzzyMatch(adjacentTownClient, adjacentTownProperty);
    const svc = MatchingService.score(adjacentTownClient, adjacentTownProperty);
    expect(svc.score).toBe(raw.score);
    expect(svc.reasons.find((r) => r.component === "town")?.score).toBe(70);
  });

  it("complete mismatch: service score === raw score, below minimum", () => {
    const raw = scoreFuzzyMatch(mismatchClient, mismatchProperty);
    const svc = MatchingService.score(mismatchClient, mismatchProperty);
    expect(svc.score).toBe(raw.score);
    expect(MatchingService.meetsMinimum(svc)).toBe(false);
  });

  it("flex beds: service score === raw score", () => {
    const raw = scoreFuzzyMatch(flexBedsClient, flexBedsProperty);
    const svc = MatchingService.score(flexBedsClient, flexBedsProperty);
    expect(svc.score).toBe(raw.score);
    expect(svc.reasons.find((r) => r.component === "beds")?.score).toBeGreaterThan(0);
    expect(svc.reasons.find((r) => r.component === "beds")?.score).toBeLessThan(100);
  });

  it("no preferences: service score === raw score", () => {
    const raw = scoreFuzzyMatch(noPreferencesClient, anyProperty);
    const svc = MatchingService.score(noPreferencesClient, anyProperty);
    expect(svc.score).toBe(raw.score);
  });

  it("meetsMinimum uses MATCH_MIN_SCORE threshold", () => {
    // Score of exactly MATCH_MIN_SCORE should pass
    const result = MatchingService.score(perfectClient, perfectProperty);
    expect(result.score).toBeGreaterThanOrEqual(MATCH_MIN_SCORE);
    expect(MatchingService.meetsMinimum(result)).toBe(true);
  });

  it("badgeReasons filters zero-score components", () => {
    const result = MatchingService.score(mismatchClient, mismatchProperty);
    const badges = MatchingService.badgeReasons(result);
    // If all components score 0 (complete mismatch), badges is empty
    const zeroComponents = result.reasons.filter((r) => r.score === 0).length;
    expect(badges.length).toBe(result.reasons.length - zeroComponents);
  });

  // ─── Weight guard ────────────────────────────────────────────────────────────
  // If weights change this test breaks — that's intentional.
  it("weight guard: town=35, budget=35, beds=20, baths=10", () => {
    // All-100 client/property → score 100
    const all100 = MatchingService.score(perfectClient, perfectProperty);
    expect(all100.score).toBe(100);

    // Only town passes (100), rest fail (0) → score = 100*35/100 = 35
    const townOnlyClient: MatchClient = {
      id: "wg",
      preferred_towns: ["Montclair"],
      nearby_towns_ok: false,
      budget_min: 1_000_000,
      budget_max: 1_100_000,
      budget_flex_pct: 1, // tight — $1M property won't pass
      beds_wanted: 10,
      bed_flex: 0,
      baths_wanted: 10,
      bath_flex: 0,
    };
    const townOnlyProperty: MatchProperty = {
      id: "wg-p",
      price: 200_000,
      town: "Montclair",
      beds: 2,
      baths: 1,
    };
    const townOnly = MatchingService.score(townOnlyClient, townOnlyProperty);
    // town=100, budget=0 (way under), beds=0 (not enough, no flex), baths=0
    expect(townOnly.score).toBe(35);
    expect(townOnly.reasons.find((r) => r.component === "town")?.score).toBe(100);
    expect(townOnly.reasons.find((r) => r.component === "budget")?.score).toBe(0);
    expect(townOnly.reasons.find((r) => r.component === "beds")?.score).toBe(0);
    expect(townOnly.reasons.find((r) => r.component === "baths")?.score).toBe(0);
  });
});
