import { describe, expect, it } from "vitest";
import { bulkReason, parseAddress, stripQuoted } from "@/lib/inbox/triage";

describe("Gmail triage", () => {
  it("parses From headers", () => {
    expect(parseAddress('"Dana Buyer" <Dana@Example.com>')).toEqual({ name: "Dana Buyer", email: "dana@example.com" });
    expect(parseAddress("pat@example.com")).toEqual({ name: "pat@example.com", email: "pat@example.com" });
  });

  it("flags bulk mail and lets people through", () => {
    expect(bulkReason(["CATEGORY_PROMOTIONS"], [], "deals@shop.com")).toBe("Promotion");
    expect(bulkReason([], [{ name: "List-Unsubscribe", value: "<mailto:x>" }], "news@x.com")).toBe("Newsletter");
    expect(bulkReason([], [], "no-reply@service.com")).toBe("No-reply sender");
    expect(bulkReason(["INBOX"], [], "dana@example.com")).toBeNull();
    // Small offices write from role addresses; those are people.
    expect(bulkReason(["INBOX"], [], "info@titleco.com")).toBeNull();
  });

  it("drops quoted history from replies", () => {
    expect(stripQuoted("Sounds good!\n\nOn Tue, Oct 20, 2026 Sam wrote:\n> earlier")).toBe("Sounds good!");
    expect(stripQuoted("Yes\n> quoted\nThanks")).toBe("Yes\nThanks");
  });
});
