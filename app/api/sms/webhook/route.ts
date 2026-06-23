// POST /api/sms/webhook
//
// Twilio calls this endpoint when a client replies to an SMS.
// Captures the inbound message and links it to the correct client.
//
// This route is unauthenticated (Twilio has no session cookie).
// Security comes from Twilio signature validation.
//
// Twilio configuration: set the webhook URL in the Twilio console to
//   https://getariaai.com/api/sms/webhook
// and set HTTP method to POST.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { formatPhoneE164 } from "@/lib/utils";
import { redactPhone } from "@/lib/redact";

export const dynamic = "force-dynamic";

// Twilio sends inbound SMS as application/x-www-form-urlencoded.
// We must return a TwiML <Response/> to acknowledge receipt.
const TWIML_OK = '<Response/>';
const XML_HEADERS = { "Content-Type": "text/xml" };

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // ── 1. Parse form body ─────────────────────────────────────────────────────
  let text: string;
  try {
    text = await req.text();
  } catch {
    return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
  }

  const params = Object.fromEntries(new URLSearchParams(text));
  const from = params.From ?? "";     // E.164 e.g. +12015551234
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? "";

  if (!from || !body) {
    return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
  }

  // ── 2. Validate Twilio signature ───────────────────────────────────────────
  // Skip only in development. In production, a missing auth token is a
  // misconfiguration — fail closed rather than silently skipping validation.
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) {
    if (!authToken) {
      console.error("[sms/webhook] TWILIO_AUTH_TOKEN is not set — rejecting request");
      return new Response(TWIML_OK, { status: 403, headers: XML_HEADERS });
    }

    const signature = req.headers.get("x-twilio-signature") ?? "";
    const webhookUrl = `${siteUrl}/api/sms/webhook`;

    const valid = validateRequest(authToken, signature, webhookUrl, params);
    if (!valid) {
      console.warn("[sms/webhook] Invalid Twilio signature — rejected");
      return new Response(TWIML_OK, { status: 403, headers: XML_HEADERS });
    }
  }

  // ── 3. Normalize phone number ──────────────────────────────────────────────
  const normalized = formatPhoneE164(from);
  if (!normalized) {
    // Unparseable number — acknowledge and discard.
    return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
  }

  const supabase = createAdminClient();

  // ── 4. Look up client by phone ─────────────────────────────────────────────
  // ROUTING LIMITATION: We look up client by phone number alone.
  // This works correctly today because there is one Twilio number per
  // deployment. If multi-agent / multi-number routing is added in the future,
  // this must be updated to also match on `To` (the Twilio number that received
  // the message) against a per-agent phone number table.
  // TODO: When multi-agent routing is needed, add a `twilio_numbers` table
  //       mapping Twilio phone → agent_id and join on `params.To` here.
  const { data: client } = await supabase
    .from("clients")
    .select("id, agent_id")
    .eq("phone", normalized)
    .limit(1)
    .maybeSingle();

  if (!client) {
    // Unknown number — log and acknowledge. Do not create a ghost record.
    console.info("[sms/webhook] Inbound SMS from unknown number:", redactPhone(normalized));
    return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
  }

  // ── 5. Dedup by MessageSid ─────────────────────────────────────────────────
  // Twilio retries if we return a non-2xx. Guard against duplicate inserts.
  if (messageSid) {
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .eq("external_id", messageSid)
      .maybeSingle();

    if (existing) {
      return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
    }
  }

  // ── 6. Insert inbound activity ─────────────────────────────────────────────
  const { error } = await supabase.from("activities").insert({
    client_id: client.id,
    agent_id: client.agent_id,
    type: "text",
    direction: "inbound",
    body,
    external_id: messageSid || null,
    ai_draft: false,
    approved: true,
    sent: false, // The client sent it, not the agent
  });

  if (error) {
    console.error("[sms/webhook] Insert error:", error.message);
    // Still return 200 so Twilio doesn't retry.
  }

  return new Response(TWIML_OK, { status: 200, headers: XML_HEADERS });
}

// Twilio performs a GET health check on some configurations.
export async function GET() {
  return NextResponse.json({ ok: true });
}
