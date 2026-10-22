import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const { clientIp, rateLimited } = await import("@/lib/rate-limit");

const req = (headers: Record<string, string> = {}) => new Request("http://test/api/x", { method: "POST", headers });

describe("rate limiting", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("keys on the first forwarded IP", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req())).toBe("unknown");
  });

  it("allows requests within the budget", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimited(req({ "x-forwarded-for": "203.0.113.7" }), "aiSearch")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "aiSearch:203.0.113.7", p_window_seconds: 600, p_max: 30 });
  });

  it("answers 429 with Retry-After once the budget is spent", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await rateLimited(req(), "inquiry");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("600");
  });

  it("fails open when the counter is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    expect(await rateLimited(req(), "bbaSign")).toBeNull();
    rpc.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await rateLimited(req(), "bbaSign")).toBeNull();
  });
});
