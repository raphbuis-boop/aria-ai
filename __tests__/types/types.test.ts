/**
 * Types structural test — Phase 1
 * Verifies that the shared types module exports the expected symbols.
 * Real shape tests added in Phase 2 with Zod schema validation.
 */
import { describe, it, expect } from "vitest";

describe("lib/types exports", () => {
  it("imports without error", async () => {
    const types = await import("@/lib/types");
    // Enums / type guards can't be checked at runtime (erased by TS)
    // but the module should load cleanly
    expect(types).toBeDefined();
  });
});
