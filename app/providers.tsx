"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";

// Lazy-load the page view tracker so it never runs server-side.
const PostHogPageView = dynamic(() => import("./PostHogPageView"), {
  ssr: false,
});

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // No-op locally if env var is missing.

    // Avoid re-initializing during dev hot reloads.
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // We capture pageviews manually because Next.js App Router
      // does not fire navigation events that PostHog can hook into.
      capture_pageview: false,
      capture_pageleave: true,
      // Only create a person profile once we identify the user
      // (keeps anonymous traffic from inflating MAU).
      person_profiles: "identified_only",
      // Quieter logs in production.
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
