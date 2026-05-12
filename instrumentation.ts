/**
 * Next.js instrumentation hook — runs once per server runtime startup.
 * Required for @sentry/nextjs to initialize on the server side.
 *
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry renamed this export from `onRequestError` to `captureRequestError`
// in @sentry/nextjs v10. Next.js's hook is still called `onRequestError`,
// so we re-export the new name under the old name.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
