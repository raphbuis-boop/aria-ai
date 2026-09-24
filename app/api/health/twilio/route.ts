import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { checkTwilioSetup } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health/twilio — read-only live check of the Twilio setup the
 * outbound send path uses (credentials, account type, sending number). */
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("twilio_from_number")
    .eq("id", user.id)
    .maybeSingle();
  const agentFrom = (profile?.twilio_from_number as string | null) ?? null;

  const checks = await checkTwilioSetup(agentFrom);
  if (agentFrom) {
    checks.unshift({
      name: "Per-agent sending number",
      ok: true,
      detail: `agent_profiles.twilio_from_number = ${agentFrom} overrides TWILIO_FROM_NUMBER for your texts`,
    });
  }
  return NextResponse.json({ ok: checks.every((c) => c.ok), checks });
}
