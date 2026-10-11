import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every table holding an agent's CRM data, children before parents. Each is
 * deleted with an explicit agent filter — this runs with the service role,
 * so the filter (not RLS) is what keeps it to the caller's own rows.
 *
 * Kept on purpose: agent_profiles (name, voice, tone, signature, settings),
 * gmail_integrations (Google connection) and brokerage_bba_templates (the
 * agent's uploaded agreement templates) — setup, not CRM data.
 */
const AGENT_TABLES = [
  "activities",
  "property_matches",
  "client_engagement_events",
  "dismissed_opportunities",
  "tasks",
  "showings",
  "transactions",
  "client_deals",
  "client_documents",
  "buyer_broker_agreements",
  "notifications",
  "idx_listing_inquiries",
  "user_saved_properties",
  "listings",
  "clients",
  "properties",
] as const;

export type WipeResult = { deleted: Record<string, number>; filesRemoved: number };

/** Deletes all of one agent's CRM data and uploaded files. Throws on the first DB error. */
export async function wipeAgentData(admin: SupabaseClient, agentId: string): Promise<WipeResult> {
  // Collect storage paths before their rows go away.
  const [{ data: docs }, { data: bbas }] = await Promise.all([
    admin.from("client_documents").select("storage_path").eq("agent_id", agentId),
    admin.from("buyer_broker_agreements").select("signed_storage_path").eq("agent_id", agentId),
  ]);
  const docPaths = (docs ?? []).map((d) => d.storage_path as string | null).filter((p): p is string => Boolean(p));
  const bbaPaths = (bbas ?? []).map((b) => b.signed_storage_path as string | null).filter((p): p is string => Boolean(p));

  const deleted: Record<string, number> = {};
  for (const table of AGENT_TABLES) {
    const { error, count } = await admin.from(table).delete({ count: "exact" }).eq("agent_id", agentId);
    if (error) throw new Error(`${table}: ${error.message}`);
    deleted[table] = count ?? 0;
  }
  for (const column of ["from_agent_id", "to_agent_id"] as const) {
    const { error, count } = await admin.from("referrals").delete({ count: "exact" }).eq(column, agentId);
    if (error) throw new Error(`referrals: ${error.message}`);
    deleted.referrals = (deleted.referrals ?? 0) + (count ?? 0);
  }

  // Files are best-effort: a missing object shouldn't undo a finished wipe.
  let filesRemoved = 0;
  for (const [bucket, paths] of [["client-documents", docPaths], ["bba-templates", bbaPaths]] as const) {
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) console.error("[account-data] storage remove failed", bucket, error.message);
      filesRemoved += data?.length ?? 0;
    }
  }
  return { deleted, filesRemoved };
}
