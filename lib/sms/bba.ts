import type { SupabaseClient } from "@supabase/supabase-js";
import { insertNotification } from "@/lib/notifications";
import { sendClientSms, type SmsClient } from "@/lib/sms/outbound";
import { firstNameOf } from "@/lib/sms/lead";

/** The existing public signing page (app/bba/sign/[id]), keyed by client id.
 * It resolves the agent's default brokerage template on its own. */
export function bbaSigningUrl(clientId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://getariaai.com").replace(/\/$/, "");
  return `${base}/bba/sign/${clientId}`;
}

export async function hasSignedBba(
  supabase: SupabaseClient,
  clientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("buyer_broker_agreements")
    .select("id")
    .eq("client_id", clientId)
    .not("signed_at", "is", null)
    .maybeSingle();
  return Boolean(data);
}

/** Texts the existing BBA signing link, unless the client already signed. */
export async function sendBbaLinkSms(
  supabase: SupabaseClient,
  client: SmsClient & { name: string },
) {
  if (await hasSignedBba(supabase, client.id)) {
    return { ok: true as const, skipped: "already_signed" as const };
  }
  const firstName = firstNameOf(client.name);
  // Same copy the agent sends from BbaSection, so clients see one message style.
  const body = `Hi ${firstName} — before our showing, NJ requires a quick Buyer Broker Agreement. Takes 30 seconds on your phone: ${bbaSigningUrl(client.id)}`;
  return sendClientSms(supabase, client, body, {
    aiDraft: false,
    metadata: { kind: "bba_link" },
  });
}

/**
 * Called by POST /api/bba/[clientId] after a signature is stored: tells the
 * agent, and thanks the client over SMS if Aria has been texting them.
 */
export async function onBbaSigned(
  supabase: SupabaseClient,
  clientId: string,
  signedPdfUrl: string | null,
) {
  const { data: client } = await supabase
    .from("clients")
    .select("id, agent_id, name, phone, sms_opted_out")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  await insertNotification(supabase, {
    agent_id: client.agent_id,
    kind: "engagement_alert",
    title: `${client.name} signed the Buyer Broker Agreement`,
    body: signedPdfUrl ? "Signed PDF is on their profile." : "Signature is on their profile.",
    related_client_id: client.id,
    dedup_key: `bba_signed:${client.id}:${new Date().toISOString().slice(0, 10)}`,
  });

  const { data: linkSent } = await supabase
    .from("activities")
    .select("id")
    .eq("client_id", client.id)
    .eq("metadata->>kind", "bba_link")
    .eq("sent", true)
    .limit(1)
    .maybeSingle();

  if (linkSent) {
    await sendClientSms(
      supabase,
      client,
      "Thank you — your Buyer Broker Agreement is signed and on file. See you at the showing.",
      { aiDraft: false, metadata: { kind: "bba_signed_ack" } },
    );
  }
}
