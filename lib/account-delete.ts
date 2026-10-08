import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

/**
 * Everything outside the database that must go when an agent deletes their
 * account, done before the auth user is removed (rows cascade from it):
 *  - an active Stripe subscription is cancelled now, so they're never billed again
 *  - the Google refresh token is revoked at Google, not just forgotten
 *  - uploaded documents and signed agreements are removed from storage
 * Each step is best-effort and logged; none can block the deletion itself.
 */
export async function releaseExternalData(admin: SupabaseClient, agentId: string): Promise<void> {
  const [{ data: billing }, { data: google }, { data: docs }, { data: bbas }] = await Promise.all([
    admin.from("agent_billing").select("stripe_subscription_id, status").eq("agent_id", agentId).maybeSingle(),
    admin.from("gmail_integrations").select("refresh_token").eq("agent_id", agentId).maybeSingle(),
    admin.from("client_documents").select("storage_path").eq("agent_id", agentId),
    admin.from("buyer_broker_agreements").select("signed_storage_path").eq("agent_id", agentId),
  ]);

  const subId = billing?.stripe_subscription_id as string | null;
  if (subId && billing?.status !== "canceled" && process.env.STRIPE_SECRET_KEY) {
    try {
      await getStripe().subscriptions.cancel(subId);
    } catch (e) {
      console.error("[account-delete] stripe cancel failed", agentId, e instanceof Error ? e.message : e);
    }
  }

  const token = google?.refresh_token as string | null;
  if (token && !process.env.GOOGLE_API_BASE_URL) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch (e) {
      console.error("[account-delete] google revoke failed", agentId, e instanceof Error ? e.message : e);
    }
  }

  const files: Array<[string, string[]]> = [
    ["client-documents", (docs ?? []).map((d) => d.storage_path as string | null).filter((p): p is string => Boolean(p))],
    ["bba-templates", (bbas ?? []).map((b) => b.signed_storage_path as string | null).filter((p): p is string => Boolean(p))],
  ];
  for (const [bucket, paths] of files) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) console.error("[account-delete] storage remove failed", bucket, error.message);
    }
  }
}
