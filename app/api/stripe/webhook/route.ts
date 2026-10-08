import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncSubscription } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/**
 * Stripe → Aria. Signature-verified against STRIPE_WEBHOOK_SECRET; the raw
 * body is used as-is. Subscription state is always re-read from Stripe, so
 * out-of-order or replayed events can't leave a stale status.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: event.type });

  try {
    const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
    const subId =
      event.type === "checkout.session.completed"
        ? typeof (obj as Stripe.Checkout.Session).subscription === "string"
          ? ((obj as Stripe.Checkout.Session).subscription as string)
          : ((obj as Stripe.Checkout.Session).subscription as Stripe.Subscription | null)?.id
        : (obj as Stripe.Subscription).id;
    if (!subId) return NextResponse.json({ received: true });

    const sub = await getStripe().subscriptions.retrieve(subId);
    const matched = await syncSubscription(sub);
    if (!matched) console.warn("[stripe/webhook] no agent for subscription", sub.id, event.type);
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 → Stripe retries with backoff.
    console.error("[stripe/webhook] failed", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
