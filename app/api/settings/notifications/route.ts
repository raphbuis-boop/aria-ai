import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("agent_profiles")
    .select("notify_followups, reminder_hour_et")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    notifyFollowups: (data?.notify_followups as boolean | undefined) ?? true,
    reminderHourEt: (data?.reminder_hour_et as number | undefined) ?? 8,
  });
}

export async function PATCH(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.notifyFollowups === "boolean") {
    update.notify_followups = body.notifyFollowups;
  }
  if (typeof body.reminderHourEt === "number") {
    const hour = Math.trunc(body.reminderHourEt);
    if (hour < 0 || hour > 23) {
      return NextResponse.json({ error: "Invalid hour" }, { status: 400 });
    }
    update.reminder_hour_et = hour;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("agent_profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
