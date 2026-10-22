import { describe, expect, it } from "vitest";
import { chunk, formatShowingWhen, latestByClient, showingDayLabel } from "@/lib/reminders";

describe("showing reminders", () => {
  // The reminder cron runs at 07:00 UTC — 3 am Eastern.
  const cronRun = new Date("2026-10-22T07:00:00Z");

  it("labels an afternoon showing on the same Eastern day as today", () => {
    expect(showingDayLabel("2026-10-22T21:00:00Z", cronRun)).toBe("today"); // 5 pm EDT
    expect(showingDayLabel("2026-10-23T03:30:00Z", cronRun)).toBe("today"); // 11:30 pm EDT
  });

  it("labels the next Eastern day tomorrow, later days by weekday", () => {
    expect(showingDayLabel("2026-10-23T14:00:00Z", cronRun)).toBe("tomorrow");
    expect(showingDayLabel("2026-10-25T14:00:00Z", cronRun)).toBe("Sunday");
  });

  it("prints the time in Eastern, not server UTC", () => {
    expect(formatShowingWhen("2026-10-22T21:00:00Z")).toBe("Thu, Oct 22, 5:00 PM");
  });
});

describe("helpers", () => {
  it("keeps the newest contact per client", () => {
    const m = latestByClient([
      { client_id: "a", created_at: "2026-10-01T00:00:00Z" },
      { client_id: "a", created_at: "2026-10-05T00:00:00Z" },
      { client_id: "b", created_at: null },
    ]);
    expect(m.get("a")).toBe(Date.parse("2026-10-05T00:00:00Z"));
    expect(m.has("b")).toBe(false);
  });

  it("chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
