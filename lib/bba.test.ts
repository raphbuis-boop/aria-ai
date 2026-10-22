import { afterEach, describe, expect, it, vi } from "vitest";
import { bbaRequestClosedReason, bbaSigningUrl, bbaTermsError, isBbaToken } from "@/lib/bba";

describe("BBA terms", () => {
  afterEach(() => vi.useRealTimers());

  const valid = { commissionPct: 2.5, termStart: "2026-11-01", termEnd: "2027-04-30", searchArea: null };

  it("accepts sensible terms", () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    expect(bbaTermsError(valid)).toBeNull();
  });

  it("rejects bad commission, dates and order", () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    expect(bbaTermsError({ ...valid, commissionPct: 0 })).toMatch(/Commission/);
    expect(bbaTermsError({ ...valid, commissionPct: 12 })).toMatch(/Commission/);
    expect(bbaTermsError({ ...valid, commissionPct: Number.NaN })).toMatch(/Commission/);
    expect(bbaTermsError({ ...valid, termStart: "11/01/2026" })).toMatch(/dates/);
    expect(bbaTermsError({ ...valid, termEnd: "2026-10-31", termStart: "2026-11-01" })).toMatch(/after the start/);
    expect(bbaTermsError({ ...valid, termStart: "2026-01-01", termEnd: "2026-06-30" })).toMatch(/past/);
  });
});

describe("BBA links", () => {
  afterEach(() => vi.useRealTimers());

  it("only accepts 32-character url-safe tokens", () => {
    expect(isBbaToken("a".repeat(32))).toBe(true);
    expect(isBbaToken("A-_9".repeat(8))).toBe(true);
    expect(isBbaToken("a".repeat(31))).toBe(false);
    expect(isBbaToken("../../etc/passwd" + "a".repeat(16))).toBe(false);
  });

  it("explains why a link can't be signed: signed, then voided, then expired", () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const open = { signed_at: null, voided_at: null, expires_at: "2026-10-29T12:00:00Z" };
    expect(bbaRequestClosedReason(open)).toBeNull();
    expect(bbaRequestClosedReason({ ...open, expires_at: "2026-10-22T11:59:59Z" })).toMatch(/expired/);
    expect(bbaRequestClosedReason({ ...open, voided_at: "2026-10-21T00:00:00Z" })).toMatch(/replaced/);
    expect(bbaRequestClosedReason({ ...open, signed_at: "2026-10-21T00:00:00Z", voided_at: "x" })).toMatch(/already signed/);
  });

  it("builds the public signing URL from the site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.getariaai.com/");
    expect(bbaSigningUrl("t".repeat(32))).toBe(`https://staging.getariaai.com/bba/sign/${"t".repeat(32)}`);
    vi.unstubAllEnvs();
  });
});
