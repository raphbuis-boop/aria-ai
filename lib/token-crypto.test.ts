import { afterEach, describe, expect, it, vi } from "vitest";
import { isSealed, needsSealing, openToken, sealToken } from "@/lib/token-crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("Google token encryption", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips and never stores the token in the clear", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    const sealed = sealToken("1//refresh-token");
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("refresh-token");
    expect(sealToken("1//refresh-token")).not.toBe(sealed); // fresh IV each time
    expect(openToken(sealed)).toBe("1//refresh-token");
  });

  it("reads plaintext rows written before the key existed, and flags them for sealing", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    expect(openToken("ya29.plain")).toBe("ya29.plain");
    expect(needsSealing("ya29.plain")).toBe(true);
  });

  it("stores as before when no key is configured", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    expect(sealToken("ya29.plain")).toBe("ya29.plain");
    expect(needsSealing("ya29.plain")).toBe(false);
  });

  it("refuses tampered ciphertext and a missing key", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    const sealed = sealToken("secret");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => openToken(tampered)).toThrow();
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    expect(() => openToken(sealed)).toThrow(/not set/);
  });

  it("rejects a key of the wrong size", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(16).toString("base64"));
    expect(() => sealToken("x")).toThrow(/32 bytes/);
  });
});
