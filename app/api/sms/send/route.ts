import twilio from "twilio";
import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { formatPhoneE164 } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const from =
    process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_FROM_NUMBER;

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

    // Twilio accepted the message. Now persist the activity.
    // If the DB write fails we still return an error — "Sent" must only appear
    // when the message is both queued by Twilio AND recorded in the thread.
    if (activityId) {
      const { error: dbErr } = await supabase
        .from("activities")
        .update({ sent: true, approved: true, body: textBody })
        .eq("id", activityId)
        .eq("agent_id", user.id);

      if (dbErr) {
        console.error("[sms/send] activity update failed:", dbErr.message);
        return NextResponse.json(
          {
            success: false,
            error: "Message sent via Twilio but could not save to thread. Refresh to check.",
            messageSid: msg.sid,
          },
          { status: 500 },
        );
      }
    } else {
      const { error: dbErr } = await supabase.from("activities").insert({
        client_id: clientId,
        agent_id: user.id,
        type: "text",
        body: textBody,
        ai_draft: false,
        approved: true,
        sent: true,
      });

      if (dbErr) {
        console.error("[sms/send] activity insert failed:", dbErr.message);
        return NextResponse.json(
          {
            success: false,
            error: "Message sent via Twilio but could not save to thread. Refresh to check.",
            messageSid: msg.sid,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true, messageSid: msg.sid });
  } catch (e: unknown) {
    // Twilio throws structured errors with a `code` field for known failures.
    // Surface the full message so the user can see exactly why it failed.
    // Common codes: 21608 = unverified number on trial account,
    //               21211 = invalid To number, 21606 = from number not SMS-capable.
    const err = e as { message?: string; code?: number; moreInfo?: string };
    const userMessage = err.code === 21608
      ? "Message not delivered: your Twilio account is in trial mode and can only send to verified numbers. Verify the recipient in the Twilio console."
      : err.message ?? "Twilio error";

    return NextResponse.json(
      { success: false, error: userMessage, twilioCode: err.code },
      { status: 400 },
    );
  }
}
