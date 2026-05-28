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

  if (!clientId || !messageBody) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 });
  }

  await supabase.from("activities").insert({
    client_id: clientId,
    agent_id: user.id,
    type: channel,
    body: messageBody,
    ai_draft: false,
    approved: true,
    sent: true,
  });

  return NextResponse.json({ logged: true });
}
