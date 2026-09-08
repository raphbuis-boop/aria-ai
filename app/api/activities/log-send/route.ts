import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId ?? "");
  const messageBody = String(body.body ?? "");
  const channel = String(body.channel ?? "sms");
  const activityId = body.activityId as string | undefined;

  if (!clientId || !messageBody) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 });
  }

  // A pending AI draft being approved updates its own row instead of creating
  // a duplicate — same convention the old Twilio route used.
  if (activityId) {
    await supabase
      .from("activities")
      .update({ sent: true, approved: true, body: messageBody })
      .eq("id", activityId)
      .eq("agent_id", user.id);
  } else {
    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: channel,
      body: messageBody,
      ai_draft: false,
      approved: true,
      sent: true,
    });
  }

  return NextResponse.json({ logged: true });
}
