/**
 * Sentry config — client (browser).
 *
 * Loaded automatically by @sentry/nextjs in the browser bundle.
 * DSN comes from NEXT_PUBLIC_SENTRY_DSN (must be public so it can
 * be embedded in the client bundle).
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring. Lower in prod once we have traffic
  // to avoid burning through the free tier (10% is a reasonable start).
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay — captures DOM snapshots around errors. Useful for
  // reproducing real-estate-agent UX issues. 10% of sessions, 100% of
  // sessions where an error occurs.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs by default — Aria handles client PII
      // (names, phones, emails) and we don't want it leaking into replays.
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  // Don't send events during local dev unless explicitly enabled.
  enabled: process.env.NODE_ENV === "production",

  // Tag every event with the environment so prod/preview don't get mixed.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Drop noisy events we don't care about (browser extensions, network blips).
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    // Common ad-blocker / extension noise:
    "Script error.",
    /^Loading chunk \d+ failed\./,
  ],
});
