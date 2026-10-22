"use client";

// Last-resort error boundary for the root layout. Reports render errors that
// nothing else catches to Sentry, then shows Next.js's default error page.
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* App Router has no status code here; 0 renders the generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
