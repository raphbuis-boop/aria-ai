/**
 * DealService — structural placeholder
 * Real tests written in Phase 2 once the target table is confirmed.
 */
import { describe, it, expect } from "vitest";
import { DealService } from "@/lib/services/deal.service";

describe("DealService (Phase 1 stubs)", () => {
  it("list() throws TODO — not yet implemented", async () => {
    await expect(() =>
      DealService.list({} as never, "agent-1"),
    ).toThrowError(/TODO/);
  });
});
