/**
 * ContactService — structural placeholder
 * Real tests written in Phase 2 once lib/contacts.ts is extracted.
 */
import { describe, it, expect } from "vitest";
import { ContactService } from "@/lib/services/contact.service";

describe("ContactService (Phase 1 stubs)", () => {
  it("list() throws TODO — not yet implemented", async () => {
    await expect(() =>
      ContactService.list({} as never, "agent-1"),
    ).toThrowError(/TODO/);
  });

  it("get() throws TODO — not yet implemented", async () => {
    await expect(() =>
      ContactService.get({} as never, "contact-1"),
    ).toThrowError(/TODO/);
  });
});
