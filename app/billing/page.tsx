import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { billingEnabled, getStripe, stripePriceId } from "@/lib/stripe";
import { BillingActions } from "./billing-actions";

export const dynamic = "force-dynamic";

async function planLabel(): Promise<string | null> {
  if (!billingEnabled()) return null;
  try {
    const price = await getStripe().prices.retrieve(stripePriceId());
    if (price.unit_amount == null) return null;
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency.toUpperCase(), minimumFractionDigits: price.unit_amount % 100 ? 2 : 0 }).format(price.unit_amount / 100);
    return price.recurring ? `${amount} / ${price.recurring.interval}` : amount;
  } catch {
    return null; // show the page without a price rather than fail
  }
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

export default async function BillingPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(user);
  const price = await planLabel();
  const justPaid = searchParams.checkout === "success";

  let title: string;
  let body: string;
  if (access.reason === "not_allowlisted") {
    title = "Aria is invite-only right now";
    body = `${user.email} isn't on the invite list yet. If you were invited with a different email, sign in with that one — or write to support@getariaai.com.`;
  } else if (justPaid && access.reason !== "subscribed") {
    title = "Finishing up…";
    body = "Payment received. Confirming with Stripe — this page updates in a few seconds.";
  } else if (access.reason === "subscribed") {
    title = "You're subscribed";
    body = access.cancelAtPeriodEnd
      ? `Your plan ends on ${fmt(access.currentPeriodEnd)}. You can turn renewal back on in Manage billing.`
      : `Thanks for using Aria.${access.currentPeriodEnd ? ` Next renewal ${fmt(access.currentPeriodEnd)}.` : ""}`;
  } else if (access.reason === "trial") {
    title = "You're on the free trial";
    body = `Free until ${fmt(access.trialEndsAt)}. Subscribe anytime — you won't be charged before the trial ends.`;
  } else if (access.reason === "payment_required") {
    title = "Your free trial has ended";
    body = "Subscribe to keep using Aria. Your clients and history are all still here.";
  } else {
    title = "Billing";
    body = "There's nothing to pay right now.";
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center bg-background px-6 py-12 text-foreground">
      <p className="mb-6 text-center font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Aria</p>
      <h1 className="font-heading text-[30px] leading-tight">{title}</h1>
      <p className="mt-2 font-display text-body-lg text-muted-foreground">{body}</p>
      {price && access.reason !== "not_allowlisted" && access.reason !== "subscribed" ? (
        <p className="mt-6 rounded-xl border border-border bg-card px-4 py-3 font-display text-body text-foreground">
          Aria · <span className="font-semibold">{price}</span> · cancel anytime
        </p>
      ) : null}
      <BillingActions
        reason={access.reason}
        billingEnabled={access.billingEnabled}
        allowed={access.allowed}
        pending={justPaid && access.reason !== "subscribed"}
      />
    </main>
  );
}
