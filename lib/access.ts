import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingEnabled, PAYING_STATUSES, trialDays } from "@/lib/stripe";

/**
 * Who may use the app: (allowlisted) AND (subscribed OR in trial OR exempt).
 *
 * The allowlist is detected at runtime, not assumed — it was added to the
 * database by hand (public.allowed_signups + a trigger on auth.users).
 * It counts as enforced only when the trigger exists AND the table has rows:
 * an empty list would lock every existing agent out, and with an empty list
 * the trigger already blocks new signups on its own.
 *
 * Billing applies only when BILLING_ENABLED=1 (lib/stripe.ts). Until then
 * the allowlist is the only gate, exactly as before.
 */

export type AccessReason = "ok" | "exempt" | "subscribed" | "trial" | "not_allowlisted" | "payment_required";

export type Access = {
  allowed: boolean;
  reason: AccessReason;
  billingEnabled: boolean;
  trialEndsAt: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type GateStatus = { trigger: boolean; table: boolean; rows: number | null };

let gateCache: { at: number; value: GateStatus | null } | null = null;
const GATE_TTL_MS = Number(process.env.ACCESS_GATE_TTL_MS ?? 5 * 60_000);

/** What the database actually enforces at signup. Null if the check itself isn't installed yet. */
export async function signupGateStatus(): Promise<GateStatus | null> {
  if (gateCache && Date.now() - gateCache.at < GATE_TTL_MS) return gateCache.value;
  const { data, error } = await createAdminClient().rpc("signup_gate_status");
  // Migration not applied yet → treat as "no allowlist" rather than locking anyone out.
  const value = error ? null : (data as GateStatus);
  if (error) console.warn("[access] signup_gate_status unavailable:", error.message);
  gateCache = { at: Date.now(), value };
  return value;
}

export function allowlistEnforced(gate: GateStatus | null): boolean {
  return Boolean(gate?.trigger && gate.table && (gate.rows ?? 0) > 0);
}

export async function getAccess(user: Pick<User, "id" | "email" | "created_at">): Promise<Access> {
  const admin = createAdminClient();
  const enabled = billingEnabled();
  const [{ data: billing }, gate] = await Promise.all([
    admin
      .from("agent_billing")
      .select("status, exempt, current_period_end, cancel_at_period_end")
      .eq("agent_id", user.id)
      .maybeSingle(),
    signupGateStatus(),
  ]);

  const trialEnds = new Date(new Date(user.created_at).getTime() + trialDays() * 86_400_000);
  const base = {
    billingEnabled: enabled,
    trialEndsAt: trialEnds.toISOString(),
    status: (billing?.status as string | null) ?? null,
    currentPeriodEnd: (billing?.current_period_end as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(billing?.cancel_at_period_end),
  };
  const exempt = Boolean(billing?.exempt);

  if (!exempt && allowlistEnforced(gate)) {
    const { data: listed } = await admin.rpc("is_signup_allowlisted", { p_email: user.email ?? "" });
    if (!listed) return { ...base, allowed: false, reason: "not_allowlisted" };
  }
  if (exempt) return { ...base, allowed: true, reason: "exempt" };
  if (!enabled) return { ...base, allowed: true, reason: "ok" };
  if (billing?.status && PAYING_STATUSES.has(billing.status as string)) return { ...base, allowed: true, reason: "subscribed" };
  if (Date.now() < trialEnds.getTime()) return { ...base, allowed: true, reason: "trial" };
  return { ...base, allowed: false, reason: "payment_required" };
}
