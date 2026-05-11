"use client";

/**
 * Sentry smoke-test page.
 *
 * Open /sentry-example-page in production, click the button, then check
 * Sentry → Issues. If a new issue appears within ~30s, your Sentry
 * integration is working end-to-end (client SDK → ingest → dashboard).
 *
 * Safe to delete once you've verified the setup.
 */
export default function SentryExamplePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sentry smoke test</h1>
      <p className="text-center text-sm text-text-dim">
        Clicking the button throws a deliberate client-side error.
        Check Sentry → Issues to confirm capture.
      </p>
      <button
        type="button"
        className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white"
        onClick={() => {
          throw new Error(
            `Sentry smoke-test error @ ${new Date().toISOString()}`,
          );
        }}
      >
        Throw a test error
      </button>
    </main>
  );
}
