import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/** The agent's Stripe customer, created on first checkout. */
export async function ensureStripeCustomer(agentId: string, email: string | undefined): Promise<string> {
  const admin = createAdminClient();
  const { data: row } = await admin.from("agent_billing").select("stripe_customer_id").eq("agent_id", agentId).maybeSingle();
  if (row?.stripe_customer_id) return row.stripe_customer_id as string;

  const customer = await getStripe().customers.create(
    { email, metadata: { agent_id: agentId } },
    // Two quick taps on Subscribe must not create two customers.
    { idempotencyKey: `aria-customer-${agentId}` },
  );
  const { error } = await admin
    .from("agent_billing")
    .upsert({ agent_id: agentId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
  if (error) throw new Error(error.message);
  return customer.id;
}

/** Period end lives on the subscription item in newer Stripe API versions. */
function periodEnd(sub: Stripe.Subscription): number | null {
  const fromItem = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  return fromItem ?? legacy ?? null;
}

/**
 * Mirrors a Stripe subscription onto agent_billing. The agent is found by
 * subscription metadata, then by customer id — never by anything the browser
 * sent. Returns false if no agent matches (event is acknowledged, not retried).
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<boolean> {
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let agentId: string | null = sub.metadata?.agent_id ?? null;
  if (!agentId) {
    const { data } = await admin.from("agent_billing").select("agent_id").eq("stripe_customer_id", customerId).maybeSingle();
    agentId = (data?.agent_id as string | undefined) ?? null;
  }
  if (!agentId) return false;

  const end = periodEnd(sub);
  const { error } = await admin.from("agent_billing").upsert(
    {
      agent_id: agentId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: sub.items?.data?.[0]?.price?.id ?? null,
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agent_id" },
  );
  if (error) throw new Error(error.message);
  return true;
}
