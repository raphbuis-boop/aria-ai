import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  generateInboxSmsDraft,
  isPlaceholderDraftBody,
  type ClientDraftContext,
} from "@/lib/inbox-drafts";

export const dynamic = "force-dynamic";

function kindFromActivity(body: string, type: string): "welcome" | "followup_email" | "reengage" {
  const b = body.toLowerCase();
  if (b.includes("day 14") || b.includes("re-engagement")) return "reengage";
  if (type === "email" || b.includes("day 2") || b.includes("follow-up email"))
    return "followup_email";
  return "welcome";
}

/** Fills real AI text for inbox rows that still have automation placeholders. */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const onlyId = typeof payload.activityId === "string" ? payload.activityId : null;

  let query = supabase
    .from("activities")
    .select("id, body, client_id, type")
    .eq("agent_id", user.id)
    .eq("ai_draft", true)
    .eq("approved", false)
    .eq("sent", false);

  if (onlyId) {
    query = query.eq("id", onlyId);
  }

  const { data: acts } = await query;

  let updated = 0;
  for (const a of acts ?? []) {
    if (!isPlaceholderDraftBody(a.body)) continue;

    const { data: cli } = await supabase
      .from("clients")
      .select("*")
      .eq("id", a.client_id)
      .maybeSingle();
    if (!cli) continue;

    const ctx: ClientDraftContext = {
      name: cli.name,
      status: cli.status,
      town: cli.town,
      budget_min: cli.budget_min,
      budget_max: cli.budget_max,
      last_engagement_at: cli.last_engagement_at,
    };
    const kind = kindFromActivity(String(a.body ?? ""), String(a.type ?? ""));
    const body = await generateInboxSmsDraft(ctx, kind);
    await supabase.from("activities").update({ body }).eq("id", a.id).eq("agent_id", user.id);
    updated += 1;
  }

  return NextResponse.json({ updated });
}
