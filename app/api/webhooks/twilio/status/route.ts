import { parseTwilioForm, verifyTwilioSignature } from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { openAriaTask } from "@/lib/sms/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FAILED = new Set(["failed", "undelivered"]);

/**
 * Twilio delivery receipts for texts Aria sent. Records the final status on
 * the timeline activity; a failed delivery opens a task for the agent (e.g.
 * carrier filtering, unverified sender, landline).
 */
export async function POST(request: Request) {
  const params = parseTwilioForm(await request.text());
  if (!verifyTwilioSignature(request, params)) {
    return new Response("Unauthorized", { status: 403 });
  }

  const sid = params.MessageSid ?? params.SmsSid;
  const status = params.MessageStatus ?? params.SmsStatus;
  if (!sid || !status) return new Response(null, { status: 204 });

  const supabase = createAdminClient();
  const { data: activity } = await supabase
    .from("activities")
    .select("id, client_id, agent_id, metadata, clients(name)")
    .eq("external_id", sid)
    .maybeSingle();
  if (!activity) return new Response(null, { status: 204 });

  const errorCode = params.ErrorCode || null;
  await supabase
    .from("activities")
    .update({
      metadata: { ...(activity.metadata ?? {}), delivery_status: status, delivery_error: errorCode },
    })
    .eq("id", activity.id);

  if (FAILED.has(status)) {
    const client = Array.isArray(activity.clients) ? activity.clients[0] : activity.clients;
    const name = (client as { name?: string } | null)?.name ?? "a client";
    await openAriaTask(supabase, {
      agentId: activity.agent_id,
      clientId: activity.client_id,
      kind: "aria_send_failed",
      title: `Text to ${name} wasn't delivered${errorCode ? ` (Twilio ${errorCode})` : ""}`,
      notification: {
        kind: "engagement_alert",
        title: `Text to ${name} wasn't delivered`,
        body: errorCode ? `Twilio error ${errorCode}.` : "Twilio reported the message as undelivered.",
      },
    });
  }

  return new Response(null, { status: 204 });
}
