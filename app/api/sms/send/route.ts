import twilio from "twilio";
import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { formatPhoneE164 } from "@/lib/utils";

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const activityId = body.activityId as string | undefined;
  const clientId = String(body.clientId ?? "");
  const to = String(body.to ?? "");
  const textBody = String(body.body ?? "");

  if (!clientId || !textBody) {
    return NextResponse.json(
      { success: false, error: "clientId and body required" },
      { status: 400 },
    );
  }

  const formatted = formatPhoneE164(to);
  if (!formatted) {
    return NextResponse.json(
      { success: false, error: "Invalid phone number" },
      { status: 400 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return NextResponse.json(
      { success: false, error: "Twilio not configured" },
      { status: 400 },
    );
  }

  try {
    const client = twilio(sid, token);
    const msg = await client.messages.create({
      body: textBody,
      from,
      to: formatted,
    });

    if (activityId) {
      await supabase
        .from("activities")
        .update({ sent: true, approved: true })
        .eq("id", activityId)
        .eq("agent_id", user.id);
    }

    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "text",
      body: textBody,
      ai_draft: false,
      approved: true,
      sent: true,
    });

    return NextResponse.json({ success: true, messageSid: msg.sid });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json(
      { success: false, error: err.message ?? "Twilio error" },
      { status: 400 },
    );
  }
}
