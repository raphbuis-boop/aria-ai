import type { SupabaseClient } from "@supabase/supabase-js";

export type BrokerageRole = "owner" | "admin" | "agent";

export type BrokerageMembership = {
  brokerageId: string;
  role: BrokerageRole;
};

/** Owners and admins manage brokerage settings and BBA templates. */
export function canManageBrokerage(role: BrokerageRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * The agent's brokerage and role, from brokerage_members — the only source of
 * truth for membership. agent_profiles.brokerage_id is a display cache that
 * agents could once write themselves, so it is never used for access.
 *
 * Call with a service-role (admin) client.
 */
export async function getBrokerageMembership(
  admin: SupabaseClient,
  userId: string,
): Promise<BrokerageMembership | null> {
  const { data, error } = await admin
    .from("brokerage_members")
    .select("brokerage_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load brokerage membership for ${userId}: ${error.message}`);
  }
  return data
    ? { brokerageId: data.brokerage_id as string, role: data.role as BrokerageRole }
    : null;
}

/**
 * Returns the agent's brokerage membership, creating "{Full Name}'s Brokerage"
 * with the agent as owner the first time an agent without one touches a
 * brokerage-scoped feature (BBA templates, settings).
 *
 * Call with a service-role (admin) client — it writes brokerages,
 * brokerage_members and agent_profiles.brokerage_id, none of which browsers
 * may write.
 */
export async function ensureBrokerage(
  admin: SupabaseClient,
  userId: string,
  fallbackFullName?: string | null,
): Promise<BrokerageMembership> {
  const existing = await getBrokerageMembership(admin, userId);
  if (existing) return existing;

  const { data: profile } = await admin
    .from("agent_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

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
  const brokerageId = created.id as string;

  const { error: memberErr } = await admin
    .from("brokerage_members")
    .insert({ brokerage_id: brokerageId, user_id: userId, role: "owner" });

  if (memberErr) {
    await admin.from("brokerages").delete().eq("id", brokerageId);
    // 23505: a concurrent request already gave this agent a brokerage.
    if (memberErr.code === "23505") {
      const winner = await getBrokerageMembership(admin, userId);
      if (winner) return winner;
    }
    throw new Error(`Could not add agent ${userId} to their brokerage: ${memberErr.message}`);
  }

  // Keep the display cache in step, creating the profile row if signup didn't.
  const { error: upsertErr } = await admin
    .from("agent_profiles")
    .upsert(
      {
        id: userId,
        brokerage_id: brokerageId,
        full_name: (profile?.full_name as string | null | undefined) ?? null,
      },
      { onConflict: "id" },
    );

  if (upsertErr) {
    throw new Error(
      `Could not link brokerage to agent_profiles: ${upsertErr.message}`,
    );
  }

  return { brokerageId, role: "owner" };
}
