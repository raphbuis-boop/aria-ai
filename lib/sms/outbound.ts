import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, twilioErrorInfo } from "@/lib/twilio";

export type SmsClient = {
  id: string;
  agent_id: string;
  phone: string | null;
  sms_opted_out?: boolean | null;
};

export type SendResult =
  | { ok: true; activityId: string; sid: string }
  | { ok: false; activityId: string | null; error: string };

/**
 * Sends one server-side SMS to a client over Twilio and records it on the
 * client's timeline as an outbound `text` activity. The activity is written
 * first (sent=false) so a failed send still leaves the drafted copy visible
 * to the agent; it's flipped to sent=true with the Twilio SID on success.
 */
export async function sendClientSms(
  supabase: SupabaseClient,
  client: SmsClient,
  body: string,
  opts: { aiDraft?: boolean; metadata?: Record<string, unknown> } = {},
): Promise<SendResult> {
  if (!client.phone) {
    return { ok: false, activityId: null, error: "Client has no phone number" };
  }
  if (client.sms_opted_out) {
    return { ok: false, activityId: null, error: "Client opted out of SMS" };
  }

  const { data: activity, error: insertError } = await supabase
    .from("activities")
    .insert({
      client_id: client.id,
      agent_id: client.agent_id,
      type: "text",
      direction: "outbound",
      body,
      ai_draft: opts.aiDraft ?? true,
      approved: true,
      sent: false,
      metadata: { channel: "twilio", ...opts.metadata },
    })
    .select("id")
    .single();

  if (insertError || !activity) {
    return {
      ok: false,
      activityId: null,
      error: insertError?.message ?? "Failed to log outbound SMS",
    };
  }

  const { data: agent } = await supabase
    .from("agent_profiles")
    .select("twilio_from_number")
    .eq("id", client.agent_id)
    .maybeSingle();

  try {
    const sent = await sendSms({
      to: client.phone,
      body,
      from: agent?.twilio_from_number,
    });

    await supabase
      .from("activities")
      .update({ sent: true, external_id: sent.sid })
      .eq("id", activity.id);

    await supabase
      .from("clients")
      .update({ last_engagement_at: new Date().toISOString() })
      .eq("id", client.id);

    return { ok: true, activityId: activity.id, sid: sent.sid };
  } catch (error) {
    const info = twilioErrorInfo(error);
    const message = info.code ? `Twilio ${info.code}: ${info.hint ?? info.message}` : info.message;
    console.error("[sms] Twilio send failed; draft kept on timeline", {
      code: info.code,
      status: info.status,
      message: info.message,
    });
    await supabase
      .from("activities")
      .update({
        metadata: {
          channel: "twilio",
          ...opts.metadata,
          send_error: message,
          send_error_code: info.code,
          send_error_raw: info.message,
        },
      })
      .eq("id", activity.id);
    return { ok: false, activityId: activity.id, error: message };
  }
}
