import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingEnabled, getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/billing/portal → { url } of the Stripe customer portal (card, invoices, cancel). */
export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Billing isn't turned on yet." }, { status: 409 });

  const { data } = await createAdminClient().from("agent_billing").select("stripe_customer_id").eq("agent_id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet — subscribe first." }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id as string,
      return_url: `${origin}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing/portal] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't open billing. Try again." }, { status: 502 });
  }
}
