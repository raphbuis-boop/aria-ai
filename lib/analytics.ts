/**
 * Aria analytics helpers (PostHog).
 *
 * Use these instead of importing posthog-js directly so we have
 * one place to maintain the event taxonomy, types, and SSR guards.
 *
 * Add new events by extending `AriaEventMap` below — TypeScript
 * will then enforce the prop shape at every call site.
 */

import posthog from "posthog-js";

/**
 * Event taxonomy. Keys are event names; values are the prop shape.
 * Convention: snake_case event names, snake_case prop keys.
 */
export type AriaEventMap = {
  inquiry_submitted: {
    source?: "website" | "portal" | "api" | "import";
    property_id?: string;
    listing_id?: string;
    has_phone?: boolean;
    has_email?: boolean;
  };
  client_created: {
    client_id?: string;
    source?: "manual" | "inquiry" | "import" | "automation";
  };
  voice_ai_used: {
    feature?: "briefing" | "search" | "command" | "summary" | "other";
    duration_ms?: number;
    success?: boolean;
  };
};

type EventName = keyof AriaEventMap;

/**
 * Capture a typed Aria event.
 *
 * @example
 *   track("inquiry_submitted", { source: "website", listing_id });
 */
export function track<E extends EventName>(
  event: E,
  props?: AriaEventMap[E],
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, props as Record<string, unknown> | undefined);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[analytics] track failed", event, err);
    }
  }
}

/**
 * Identify the current user. Call once after login or session restore.
 * Use a stable Supabase user id — never an email or anything PII-sensitive.
 */
export function identify(
  userId: string,
  traits?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.identify(userId, traits);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[analytics] identify failed", err);
    }
  }
}

/**
 * Reset the local PostHog state. Call on sign-out so the next
 * anonymous user doesn't share a person profile with the previous one.
 */
export function resetUser(): void {
  if (typeof window === "undefined") return;
  try {
    posthog.reset();
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[analytics] reset failed", err);
    }
  }
}
