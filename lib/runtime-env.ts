/**
 * Deployment guards for diagnostics and demo-only routes.
 * Set explicit env vars in Vercel when you need these in production.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** GET /api/mls-test — off in production unless ENABLE_MLS_DIAGNOSTICS=true */
export function allowMlsDiagnostics(): boolean {
  return (
    process.env.ENABLE_MLS_DIAGNOSTICS === "true" || !isProduction()
  );
}

/**
 * POST /api/seed — writes fake demo clients into the caller's account, so it
 * must never touch a real one. Allowed only when ALL of these hold:
 *  - not running on Vercel (production *and* preview deployments are out —
 *    previews share the production database), and
 *  - Supabase is a local instance (localhost / 127.0.0.1), and
 *  - `next dev`, or ALLOW_DEMO_SEED=true for a local production build.
 * No env var can turn it on against a hosted database.
 */
export function allowDemoSeed(): boolean {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  let host = "";
  try {
    host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return false;
  }
  if (host !== "localhost" && host !== "127.0.0.1") return false;
  return !isProduction() || process.env.ALLOW_DEMO_SEED === "true";
}
