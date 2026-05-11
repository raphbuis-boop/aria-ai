/**
 * Sentry config — Edge runtime (middleware, edge route handlers).
 *
 * Aria uses middleware.ts for auth, so this is what catches errors there.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
