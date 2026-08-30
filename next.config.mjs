import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

const sentryAuthOk = Boolean(process.env.SENTRY_AUTH_TOKEN);

/**
 * Sentry build-time configuration.
 *
 * Wraps the Next.js config so the build:
 *   1. Tags release commits
 *   2. Uploads source maps to Sentry (server-side stack traces become readable)
 *   3. Tunnels Sentry traffic through /monitoring to bypass ad blockers
 *
 * The org/project are committed; the SENTRY_AUTH_TOKEN is set in Vercel
 * (and locally in .env.sentry-build-plugin if you want to upload from dev).
 *
 * When the token is missing, sourcemap upload is skipped. When it's set but
 * invalid (401), errorHandler catches that failure — but errorHandler only
 * covers the asset-upload step per Sentry's plugin docs, NOT release
 * create/finalize, which is a separate authenticated API call. That gap is
 * what actually failed the build with a real invalid token in production
 * (confirmed), so release create/finalize is unconditionally off below —
 * runtime error capture works with or without a formally created release.
 * Replace the token in Vercel → Settings → Environment Variables to restore
 * sourcemap upload; re-enable release tracking once that's confirmed working.
 */
export default withSentryConfig(nextConfig, {
  org: "aria-ec",
  project: "aria-operator",

  // Hide source map upload logs unless you're debugging the upload itself.
  silent: !process.env.CI,

  // Upload a larger set of source maps for prod; useful when you want
  // readable stack traces from third-party deps too.
  widenClientFileUpload: true,

  // NOTE: tunnelRoute removed — was causing 403s on /monitoring in prod.
  // Sentry events go directly to ingest.sentry.io now. The downside is
  // that strict ad blockers may drop a small % of client error reports,
  // but reliability across the board is better this way.

  // Skip the upload step entirely if no auth token is set
  // (keeps local builds and PRs from contributors clean).
  disableLogger: true,

  // Automatically wrap server actions / RSCs so errors get captured.
  automaticVercelMonitors: true,

  sourcemaps: {
    disable: !sentryAuthOk,
  },
  release: {
    create: false,
    finalize: false,
  },
  // Covers sourcemap upload failures (e.g. invalid token) — logs and lets
  // the build continue instead of failing it.
  errorHandler: (err) => {
    console.warn("[Sentry] sourcemap upload skipped:", err.message);
  },
});
