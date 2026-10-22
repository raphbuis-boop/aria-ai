import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAnthropic: () => ({}),
  callClaude: vi.fn(async () =>
    JSON.stringify({ towns: ["montclair", "Glen Ridge, NJ", "Atlantis"], beds: 3, baths: null, minPrice: null, maxPrice: 900000, propertyType: null, keywords: [] }),
  ),
}));

const { POST } = await import("./route");

describe("POST /api/ai/search-parse", () => {
  it("keeps the towns the buyer named, as display names", async () => {
    const res = await POST(new Request("http://test/api/ai/search-parse", {
      method: "POST",
      body: JSON.stringify({ query: "3 bed in montclair or glen ridge under 900k" }),
    }));
    const body = await res.json();
    // These used to be dropped: lowercased names were compared to display names.
    expect(body.filters.towns).toEqual(["Montclair", "Glen Ridge"]);
    expect(body.filters.beds).toBe(3);
    expect(body.filters.maxPrice).toBe(900000);
    expect(body.keywordFallback).toBe("");
  });
});
