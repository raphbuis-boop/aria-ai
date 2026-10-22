import { describe, expect, it } from "vitest";
import { MATCH_MIN_SCORE, scoreFuzzyMatch } from "@/lib/matching";
import { canonicalTown, isTownAdjacentOrEqual } from "@/lib/nj-towns";

const buyer = {
  id: "c1",
  preferred_towns: ["Ridgewood"],
  nearby_towns_ok: true,
  budget_min: 700_000,
  budget_max: 900_000,
  budget_flex_pct: 10,
  beds_wanted: 4,
  bed_flex: 1,
  baths_wanted: 2.5,
  bath_flex: 0.5,
};

describe("scoreFuzzyMatch", () => {
  it("scores a home that fits every criterion above the surfacing threshold", () => {
    const r = scoreFuzzyMatch(buyer, { id: "p1", town: "Ridgewood", price: 850_000, beds: 4, baths: 2.5 });
    expect(r.hardPass).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(MATCH_MIN_SCORE);
  });

  it("gives partial credit for an adjacent town but less than the town itself", () => {
    const home = { id: "p", price: 850_000, beds: 4, baths: 2.5 };
    const inTown = scoreFuzzyMatch(buyer, { ...home, town: "Ridgewood" }).score;
    const nextDoor = scoreFuzzyMatch(buyer, { ...home, town: "Glen Rock" }).score;
    expect(nextDoor).toBeGreaterThan(0);
    expect(nextDoor).toBeLessThan(inTown);
  });

  it("fails the hard gate when the price is far over budget", () => {
    const r = scoreFuzzyMatch(buyer, { id: "p2", town: "Ridgewood", price: 1_600_000, beds: 4, baths: 2.5 });
    expect(r.hardPass).toBe(false);
  });
});

describe("NJ towns", () => {
  it("resolves free-text towns to display names", () => {
    expect(canonicalTown("montclair, nj")).toBe("Montclair");
    expect(canonicalTown(" Ho-Ho-Kus ")).toBe(canonicalTown("ho ho kus"));
    expect(canonicalTown("Atlantis")).toBeNull();
  });

  it("treats adjacency as two-way", () => {
    expect(isTownAdjacentOrEqual("Glen Rock", "Ridgewood")).toBe(true);
    expect(isTownAdjacentOrEqual("Ridgewood", "Glen Rock")).toBe(true);
  });
});
