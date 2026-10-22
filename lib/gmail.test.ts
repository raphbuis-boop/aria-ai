import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
import { isSealed, sealToken } from "@/lib/token-crypto";

const store = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => store.current }));

const { getGoogleAuth } = await import("@/lib/gmail");

const KEY = Buffer.alloc(32, 3).toString("base64");
const row = (overrides: Record<string, unknown> = {}) => ({
  agent_id: "agent-1",
  email: "sam@gmail.test",
  access_token: "ya29.access",
  refresh_token: "1//refresh",
  token_expiry: new Date(Date.now() + 3_600_000).toISOString(), // not expired: no network
  scope: "https://www.googleapis.com/auth/gmail.readonly",
  ...overrides,
});

describe("getGoogleAuth token storage", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("encrypts tokens stored before the key was configured, and uses them decrypted", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    const { client, db } = fakeSupabase({ gmail_integrations: [row()] });
    store.current = client;

    const google = await getGoogleAuth("agent-1");
    expect(google?.auth.credentials.access_token).toBe("ya29.access");
    expect(google?.auth.credentials.refresh_token).toBe("1//refresh");

    const saved = db.gmail_integrations[0];
    expect(isSealed(saved.access_token as string)).toBe(true);
    expect(isSealed(saved.refresh_token as string)).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("1//refresh");
  });

  it("reads sealed tokens", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    const { client } = fakeSupabase({
      gmail_integrations: [row({ access_token: sealToken("ya29.access"), refresh_token: sealToken("1//refresh") })],
    });
    store.current = client;
    const google = await getGoogleAuth("agent-1");
    expect(google?.auth.credentials.refresh_token).toBe("1//refresh");
  });

  it("treats sealed tokens without the key as disconnected rather than sending ciphertext to Google", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", KEY);
    const sealed = row({ access_token: sealToken("ya29.access"), refresh_token: sealToken("1//refresh") });
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    const { client } = fakeSupabase({ gmail_integrations: [sealed] });
    store.current = client;
    expect(await getGoogleAuth("agent-1")).toBeNull();
  });
});
