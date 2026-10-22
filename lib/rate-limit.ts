import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Per-IP budgets for public (unauthenticated) endpoints. */
export const RATE_LIMITS = {
  /** Each request is a Claude call. */
  aiSearch: { max: 30, windowSeconds: 600 },
  inquiry: { max: 5, windowSeconds: 600 },
  waitlist: { max: 5, windowSeconds: 600 },
  bbaSign: { max: 10, windowSeconds: 600 },
  engagement: { max: 120, windowSeconds: 600 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** The caller's IP as the platform reports it (first X-Forwarded-For hop). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Counts this request against the caller's budget for `name` and returns a
 * 429 response once it's spent, else null. Fails open: if the counter can't
 * be reached the request goes through — dropping a real lead is worse than
 * briefly lifting a limit.
 */
export async function rateLimited(req: Request, name: RateLimitName): Promise<NextResponse | null> {
  const { max, windowSeconds } = RATE_LIMITS[name];
  let allowed: unknown;
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: `${name}:${clientIp(req)}`,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    allowed = data;
  } catch (err) {
    console.error("[rate-limit] check failed; allowing request", { name, error: err instanceof Error ? err.message : err });
    return null;
  }
  if (allowed === false) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(windowSeconds) } },
    );
  }
  return null;
}
