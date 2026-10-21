import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWebhook, signatureMatches } from "@/lib/whatsapp/webhook";
import { applyEditsAndRevokes, ingestMessages, purgeExpiredUnknownCards, type WaConnection } from "@/lib/whatsapp/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// A history chunk can hold thousands of messages.
export const maxDuration = 300;

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Meta's subscription handshake (App Dashboard → WhatsApp → Configuration → Callback URL). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    token &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    sameString(url.searchParams.get("hub.verify_token") ?? "", token)
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * WhatsApp Business coexistence webhooks for every connected agent: client
 * messages, her own messages sent from the WhatsApp Business app (echoes),
 * the one-time chat history backfill, and account changes. Aria only
 * receives — nothing here sends a message.
 *
 * Only chats with existing clients are stored (lib/whatsapp/ingest.ts);
 * nothing from this payload is logged.
 */
export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
  const raw = await request.text();
  if (!appSecret || !signatureMatches(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const supabase = createAdminClient();
  const connections = new Map<string, (WaConnection & { status: string }) | null>();
  async function connectionFor(phoneNumberId: string | null, wabaId: string | null) {
    const key = `${phoneNumberId ?? ""}|${wabaId ?? ""}`;
    if (connections.has(key)) return connections.get(key) ?? null;
    let query = supabase.from("whatsapp_connections").select("agent_id, phone_number_id, waba_id, status");
    if (phoneNumberId) query = query.eq("phone_number_id", phoneNumberId);
    else if (wabaId) query = query.eq("waba_id", wabaId);
    else return null;
    const { data } = await query.limit(1).maybeSingle();
    connections.set(key, data ?? null);
    return data ?? null;
  }

  try {
    for (const change of parseWebhook(payload)) {
      const conn = await connectionFor(change.phoneNumberId, change.account?.wabaId ?? change.wabaId);
      // Not a number connected to Aria (or she disconnected): nothing is kept.
      if (!conn || conn.status === "disconnected") continue;

      const now = new Date().toISOString();
      const update: Record<string, string | null> = { last_webhook_at: now, updated_at: now };

      if (change.account) {
        const { event, reason } = change.account;
        if (event === "PARTNER_REMOVED" || event === "PARTNER_APP_UNINSTALLED") {
          update.status = "disconnected";
          update.status_detail =
            reason === "PRIMARY_INACTIVITY"
              ? "Disconnected by WhatsApp: the WhatsApp Business app wasn't opened for about 14 days. Connect again."
              : reason === "COMPANION_INACTIVITY"
                ? "Disconnected by WhatsApp: a linked device was inactive for about 30 days. Connect again."
                : "WhatsApp is no longer connected to Aria. Connect again to keep client chats coming in.";
        } else if (event === "ACCOUNT_OFFBOARDED") {
          update.status = "broken";
          update.status_detail = "Your WhatsApp Business app was re-registered. WhatsApp usually reconnects it within minutes.";
        } else if (event === "ACCOUNT_RECONNECTED") {
          update.status = "connected";
          update.status_detail = null;
        }
      } else if (conn.status === "broken" && change.messages.length) {
        // Messages are flowing again.
        update.status = "connected";
        update.status_detail = null;
      }

      if (change.history) {
        update.history_status = change.history.declined
          ? "declined"
          : change.history.progress === 100
            ? "complete"
            : "in_progress";
      }

      if (change.messages.length) await ingestMessages(supabase, conn, change.messages);
      if (change.edits.length || change.revokes.length) {
        await applyEditsAndRevokes(supabase, conn.agent_id, change.edits, change.revokes);
      }
      await supabase.from("whatsapp_connections").update(update).eq("agent_id", conn.agent_id);
      if (update.status) conn.status = update.status;
    }
    await purgeExpiredUnknownCards(supabase);
  } catch (error) {
    // Message ids make every write idempotent, so Meta's retry is safe. Log the reason only — never the payload.
    console.error("[whatsapp/webhook] processing failed:", error instanceof Error ? error.message : "unknown error");
    return new Response("Retry", { status: 500 });
  }

  return Response.json({ ok: true });
}
