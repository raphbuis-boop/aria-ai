import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";
import { AGENT_LICENSE, BROKERAGE_NAME } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Same proven-safe select as the Home screen. license_state is NOT
  // selected here — confirmed via a live query error (42703, undefined
  // column) that it doesn't actually exist on this production table, despite
  // being declared in the (unapplied) baseline_schema.sql reconstruction —
  // same class of gap as clients.updated_at found earlier. Selecting it made
  // the whole query fail atomically, nulling out full_name/email too.
  const { data: profile, error } = await supabase
    .from("agent_profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error) console.error("[profile] agent_profiles:", error);

  const agent = {
    fullName: (profile?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? "Agent",
    email: (profile?.email as string | undefined) ?? user.email ?? "",
    // agent_profiles has no brokerage set for this agent — BROKERAGE_NAME is
    // this practice's real, already-established brokerage (the same value
    // used in the IDX legal disclaimer elsewhere), not a fabricated one.
    brokerage: BROKERAGE_NAME,
    // agent_profiles has no license-number column — AGENT_LICENSE is the
    // same real compliance constant already used in IdxComplianceNotice.
    license: AGENT_LICENSE,
    // license_state column doesn't exist on production (see above) — NJ is
    // the correct value for this practice regardless (CLAUDE.md documents it
    // as the intended default), so it's a safe fixed value, not a guess.
    licenseState: "NJ",
  };

  return <ProfileClient agent={agent} />;
}
