import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures the given agent has an associated brokerage. In v1 we model
 * "one agent = one brokerage", lazy-creating a default brokerage named
 * "{Full Name}'s Brokerage" the first time an agent touches a
 * brokerage-scoped feature (BBA templates, settings BBA section, etc.).
 *
 * Call this with a service-role (admin) client — it writes to `brokerages`
 * and `agent_profiles` and needs to bypass RLS.
 *
 * Returns the brokerage_id.
 */
export async function ensureBrokerage(
  admin: SupabaseClient,
  userId: string,
  fallbackFullName?: string | null,
): Promise<string> {
  const { data: profile } = await admin
    .from("agent_profiles")
    .select("id, full_name, brokerage_id")
    .eq("id", userId)
    .maybeSingle();

  const existing = (profile?.brokerage_id as string | null) ?? null;
  if (existing) return existing;

  const name =
    (profile?.full_name as string | null | undefined) ||
    fallbackFullName ||
    "My";

  const { data: created, error: createErr } = await admin
    .from("brokerages")
    .insert({
      name: `${name}'s Brokerage`,
      owner_agent_id: userId,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    throw new Error(
      `Could not create brokerage for agent ${userId}: ${createErr?.message ?? "unknown error"}`,
    );
  }

  // Upsert the agent_profile so a row exists even if signup didn't create one,
  // and set the brokerage_id link.
  const { error: upsertErr } = await admin
    .from("agent_profiles")
    .upsert(
      {
        id: userId,
        brokerage_id: created.id,
        full_name: profile?.full_name ?? null,
      },
      { onConflict: "id" },
    );

  if (upsertErr) {
    throw new Error(
      `Could not link brokerage to agent_profiles: ${upsertErr.message}`,
    );
  }

  return created.id as string;
}
