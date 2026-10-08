import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getAccess } from "@/lib/access";
import { ensureStripeCustomer } from "@/lib/billing";
import { billingEnabled, getStripe, stripePriceId } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/billing/checkout → { url } of a Stripe Checkout page for the monthly plan. */
export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Billing isn't turned on yet." }, { status: 409 });

  const access = await getAccess(user);
  if (access.reason === "not_allowlisted") return NextResponse.json({ error: "This account doesn't have access yet." }, { status: 403 });
  if (access.reason === "subscribed") return NextResponse.json({ error: "You're already subscribed." }, { status: 409 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const customer = await ensureStripeCustomer(user.id, user.email);
    // Subscribing mid-trial keeps the rest of the free days: first charge
    // happens when the trial would have ended (Stripe needs ≥ 48h ahead).
    const trialEnd = access.trialEndsAt ? Math.floor(new Date(access.trialEndsAt).getTime() / 1000) : 0;
    const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 48 * 3600;
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: stripePriceId(), quantity: 1 }],
      subscription_data: { metadata: { agent_id: user.id }, ...(keepTrial ? { trial_end: trialEnd } : {}) },
      allow_promotion_codes: true,
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing/checkout] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 502 });
  }
}
