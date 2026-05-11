/**
 * Sentry config — Node server runtime (API routes + Server Components).
 *
 * Loaded automatically by @sentry/nextjs in the Node runtime.
 * DSN here is the same DSN as the browser; we use the non-public
 * env var name on the server side for hygiene, falling back to the
 * public one so dev "just works".
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
