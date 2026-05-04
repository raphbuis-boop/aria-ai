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

/** POST /api/seed — off in production unless ALLOW_DEMO_SEED=true */
export function allowDemoSeed(): boolean {
  return process.env.ALLOW_DEMO_SEED === "true" || !isProduction();
}
