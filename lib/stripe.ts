import Stripe from "stripe";

/**
 * Server-side Stripe client. Billing is off unless BILLING_ENABLED=1 and the
 * secret key + price are set — until then the signup allowlist alone controls
 * access (lib/access.ts).
 *
 * STRIPE_API_BASE is for local end-to-end tests only (points the SDK at a
 * stand-in server); never set it in production.
 */
let client: Stripe | null = null;

export function billingEnabled(): boolean {
  return (
    process.env.BILLING_ENABLED === "1" &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim()) &&
    Boolean(process.env.STRIPE_PRICE_ID?.trim())
  );
}

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client = new Stripe(key, {
    appInfo: { name: "Aria" },
    ...(base
      ? { host: base.hostname, port: Number(base.port || 80), protocol: base.protocol.replace(":", "") as "http" | "https" }
      : {}),
  });
  return client;
}

export function stripePriceId(): string {
  return process.env.STRIPE_PRICE_ID!.trim();
}

/** Days of free use from signup before a subscription is required. */
export function trialDays(): number {
  const n = Number(process.env.TRIAL_DAYS ?? 14);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 14;
}

/** Subscription statuses that keep the app open. past_due gets Stripe's retry window. */
export const PAYING_STATUSES = new Set(["active", "trialing", "past_due"]);
