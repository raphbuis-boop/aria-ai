import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

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
 */
export default withSentryConfig(nextConfig, {
  org: "aria-ec",
  project: "javascript-nextjs",

  // Hide source map upload logs unless you're debugging the upload itself.
  silent: !process.env.CI,

  // Upload a larger set of source maps for prod; useful when you want
  // readable stack traces from third-party deps too.
  widenClientFileUpload: true,

  // Route Sentry SDK traffic through this path so ad blockers
  // (which often block "sentry.io") don't drop client error reports.
  tunnelRoute: "/monitoring",

  // Skip the upload step entirely if no auth token is set
  // (keeps local builds and PRs from contributors clean).
  disableLogger: true,

  // Automatically wrap server actions / RSCs so errors get captured.
  automaticVercelMonitors: true,
});
