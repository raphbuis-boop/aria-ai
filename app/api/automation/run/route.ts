import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { generateInboxSmsDraft, type ClientDraftContext } from "@/lib/inbox-drafts";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id);

  if (!clients?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  const now = Date.now();

  for (const c of clients) {
    const created = new Date(c.created_at).getTime();
    const daysSince = Math.floor((now - created) / DAY_MS);
    const automationDay = c.automation_day ?? 0;
    const lastAt = c.last_automation_at
      ? new Date(c.last_automation_at).getTime()
      : 0;

    const shouldRun = (triggerDay: number) =>
      daysSince >= triggerDay &&
      automationDay < triggerDay &&
      now - lastAt > DAY_MS * 0.9;

    let nextDay = automationDay;
    let did = false;

    const ctx: ClientDraftContext = {
      name: c.name,
      status: c.status,
      town: c.town,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      last_engagement_at: c.last_engagement_at,
    };

    if (shouldRun(1)) {
      const body = await generateInboxSmsDraft(ctx, "welcome");
      await supabase.from("activities").insert({
        client_id: c.id,
        agent_id: user.id,
        type: "automation",
        body,
        ai_draft: true,
        approved: false,
        sent: false,
      });
      nextDay = Math.max(nextDay, 1);
      did = true;
    } else if (shouldRun(2)) {
      const body = await generateInboxSmsDraft(ctx, "followup_email");
      await supabase.from("activities").insert({
        client_id: c.id,
        agent_id: user.id,
        type: "email",
        body,
        ai_draft: true,
        approved: false,
        sent: false,
      });
      nextDay = Math.max(nextDay, 2);
      did = true;
    } else if (shouldRun(5)) {
      await supabase.from("tasks").insert({
        client_id: c.id,
        agent_id: user.id,
        title: `5-day check-in: ${c.name}`,
        due_at: new Date().toISOString(),
        ai_generated: true,
        done: false,
      });
      nextDay = Math.max(nextDay, 5);
      did = true;
    } else if (shouldRun(14)) {
      const body = await generateInboxSmsDraft(ctx, "reengage");
      await supabase.from("activities").insert({
        client_id: c.id,
        agent_id: user.id,
        type: "automation",
        body,
        ai_draft: true,
        approved: false,
        sent: false,
      });
      nextDay = Math.max(nextDay, 14);
      did = true;
    } else if (shouldRun(30)) {
      await supabase.from("tasks").insert({
        client_id: c.id,
        agent_id: user.id,
        title: `Archive / re-qualify: ${c.name}`,
        due_at: new Date(Date.now() + DAY_MS * 3).toISOString(),
        ai_generated: true,
        done: false,
      });
      nextDay = Math.max(nextDay, 30);
      did = true;
    }

    if (did) {
      processed += 1;
      await supabase
        .from("clients")
        .update({
          automation_day: nextDay,
          last_automation_at: new Date().toISOString(),
        })
        .eq("id", c.id);
    }
  }

  return NextResponse.json({ processed });
}
