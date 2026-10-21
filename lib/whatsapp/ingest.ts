import type { SupabaseClient } from "@supabase/supabase-js";
import { firstLine } from "./followups";
import { MEDIA_LABELS } from "./thread";

/**
 * Turns WhatsApp webhook messages into CRM activity — for clients only.
 *
 * Privacy rule: a message is written only when the other party's number is
 * one of an existing client's numbers (clients.phones, E.164). Everything
 * else is dropped here and never touches the database. The one exception is
 * a live message from an unknown number: its number and first line become a
 * 24-hour "New number messaged you — add as client?" card.
 */

export type WaSource = "message" | "echo" | "history";

/** One message, already pulled out of the webhook payload (lib/whatsapp/webhook.ts). */
export type WaMessage = {
  /** WhatsApp message id (wamid…). */
  id: string;
  /** inbound = client → agent; outbound = agent → client (sent from her phone). */
  direction: "inbound" | "outbound";
  /** The client side of the chat, E.164. */
  counterpart: string;
  /** ISO timestamp from WhatsApp. */
  at: string;
  /** WhatsApp message type: text, image, audio… */
  type: string;
  /** Text body or media caption. */
  text: string | null;
  source: WaSource;
};

export type WaConnection = { agent_id: string; phone_number_id: string; waba_id: string };

export type IngestResult = { stored: number; duplicates: number; dropped: number; unknownCards: number };

type ClientRef = { id: string; phones: string[] | null; last_engagement_at: string | null; last_inbound_at: string | null; drip_paused_at: string | null };

/** Message types that are a conversation turn. Reactions, system notices and unsupported types aren't. */
const STORED_TYPES = new Set(["text", "image", "video", "audio", "document", "sticker", "location", "contacts", "interactive", "button", "media_placeholder"]);

/** wa_id ("12015550134") → E.164 ("+12015550134"). */
export function waIdToE164(waId: string | null | undefined): string | null {
  const digits = (waId ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

const UNKNOWN_CARD_TTL_MS = 24 * 3_600_000;
/** A WhatsApp send she opened from Aria (wa.me) is logged before it's sent; the echo confirms it within this window. */
const DEEPLINK_MATCH_MS = 60 * 60_000;

async function matchClients(supabase: SupabaseClient, agentId: string, phones: string[]): Promise<Map<string, ClientRef>> {
  const byPhone = new Map<string, ClientRef>();
  for (let i = 0; i < phones.length; i += 200) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, phones, last_engagement_at, last_inbound_at, drip_paused_at")
      .eq("agent_id", agentId)
      .overlaps("phones", phones.slice(i, i + 200));
    if (error) throw new Error(`clients: ${error.message}`);
    for (const c of (data ?? []) as ClientRef[]) {
      for (const p of c.phones ?? []) if (!byPhone.has(p)) byPhone.set(p, c);
    }
  }
  return byPhone;
}

function bodyFor(m: WaMessage): string | null {
  if (m.text?.trim()) return m.text.trim().slice(0, 4000);
  return m.type === "text" ? null : `[${MEDIA_LABELS[m.type] ?? "Attachment"}]`;
}

/** An echo of a message she opened from Aria's draft sheet: confirm that logged row instead of adding a second one. */
async function mergeIntoDeepLinkSend(supabase: SupabaseClient, agentId: string, clientId: string, m: WaMessage, row: Record<string, unknown>): Promise<boolean> {
  const at = new Date(m.at).getTime();
  const { data: logged } = await supabase
    .from("activities")
    .select("id")
    .eq("agent_id", agentId)
    .eq("client_id", clientId)
    .eq("type", "whatsapp")
    .is("external_id", null)
    .eq("sent", true)
    .gte("created_at", new Date(at - DEEPLINK_MATCH_MS).toISOString())
    .lte("created_at", new Date(at + 5 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!logged) return false;
  // What she actually sent wins over the draft she opened.
  const { error } = await supabase.from("activities").update(row).eq("id", logged.id);
  return !error;
}

type Effect = { client: ClientRef; latest: string; latestInbound: string | null; liveInbound: boolean };

export async function ingestMessages(supabase: SupabaseClient, conn: WaConnection, messages: WaMessage[]): Promise<IngestResult> {
  const result: IngestResult = { stored: 0, duplicates: 0, dropped: 0, unknownCards: 0 };
  const usable = messages.filter((m) => m.id && m.counterpart && STORED_TYPES.has(m.type));
  result.dropped += messages.length - usable.length;
  if (!usable.length) return result;

  const clients = await matchClients(supabase, conn.agent_id, [...new Set(usable.map((m) => m.counterpart))]);

  // Per client: the newest message of any kind, the newest one from them, and whether a live reply came in.
  const effects = new Map<string, Effect>();
  const markStored = (m: WaMessage, client: ClientRef) => {
    result.stored++;
    const e = effects.get(client.id) ?? { client, latest: m.at, latestInbound: null, liveInbound: false };
    if (m.at > e.latest) e.latest = m.at;
    if (m.direction === "inbound") {
      if (!e.latestInbound || m.at > e.latestInbound) e.latestInbound = m.at;
      if (m.source === "message") e.liveInbound = true;
    }
    effects.set(client.id, e);
  };

  const pending = new Map<string, { row: Record<string, unknown>; m: WaMessage; client: ClientRef }>();
  for (const m of usable) {
    const client = clients.get(m.counterpart);
    if (!client) {
      // Not a client: drop it. A live message from them becomes a short-lived "add as client?" card.
      result.dropped++;
      if (m.source === "message" && m.direction === "inbound") {
        const { error } = await supabase.from("whatsapp_unknown_senders").upsert(
          {
            agent_id: conn.agent_id,
            phone: m.counterpart,
            first_line: firstLine(bodyFor(m)),
            message_id: m.id,
            received_at: m.at,
            expires_at: new Date(Date.now() + UNKNOWN_CARD_TTL_MS).toISOString(),
          },
          { onConflict: "agent_id,phone" },
        );
        if (!error) result.unknownCards++;
      }
      continue;
    }

    const row = activityRow(conn.agent_id, client.id, m);
    if (m.source === "echo" && (await mergeIntoDeepLinkSend(supabase, conn.agent_id, client.id, m, row))) {
      markStored(m, client);
      continue;
    }
    if (pending.has(row.external_id)) result.duplicates++;
    else pending.set(row.external_id, { row, m, client });
  }

  // Skip what's already stored (webhook retries; history overlapping live messages), then insert in bulk.
  const ids = [...pending.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("activities").select("external_id").in("external_id", ids.slice(i, i + 200));
    for (const r of data ?? []) {
      if (pending.delete(String(r.external_id))) result.duplicates++;
    }
  }
  const fresh = [...pending.values()];
  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500);
    const { error } = await supabase.from("activities").insert(chunk.map((x) => x.row));
    if (!error) {
      for (const x of chunk) markStored(x.m, x.client);
      continue;
    }
    if (error.code !== "23505") throw new Error(`activities: ${error.message}`);
    // A concurrent delivery stored some of these first: insert one by one.
    for (const x of chunk) {
      const { error: rowError } = await supabase.from("activities").insert(x.row);
      if (rowError?.code === "23505") result.duplicates++;
      else if (rowError) throw new Error(`activities: ${rowError.message}`);
      else markStored(x.m, x.client);
    }
  }

  for (const [clientId, e] of effects) await applyEffects(supabase, conn.agent_id, clientId, e);
  return result;
}

function activityRow(agentId: string, clientId: string, m: WaMessage) {
  return {
    client_id: clientId,
    agent_id: agentId,
    type: "whatsapp",
    direction: m.direction,
    body: bodyFor(m),
    ai_draft: false,
    approved: true,
    sent: true,
    external_id: `wa:${m.id}`,
    created_at: m.at,
    metadata: {
      channel: "whatsapp",
      source: m.source,
      ...(m.type !== "text" ? { media_type: m.type } : {}),
    },
  };
}

/** She edited a message, or either side deleted one for everyone: mirror it on the stored copy (clients only — nothing else is stored). */
export async function applyEditsAndRevokes(
  supabase: SupabaseClient,
  agentId: string,
  edits: { originalId: string; text: string | null; type: string }[],
  revokes: string[],
) {
  for (const e of edits) {
    const { data: row } = await supabase
      .from("activities")
      .select("id, metadata")
      .eq("agent_id", agentId)
      .eq("external_id", `wa:${e.originalId}`)
      .maybeSingle();
    if (!row) continue;
    await supabase
      .from("activities")
      .update({
        body: e.text?.trim() || `[${MEDIA_LABELS[e.type] ?? "Attachment"}]`,
        metadata: { ...((row.metadata as Record<string, unknown> | null) ?? {}), edited: true },
      })
      .eq("id", row.id);
  }
  if (revokes.length) {
    await supabase
      .from("activities")
      .delete()
      .eq("agent_id", agentId)
      .in("external_id", revokes.map((id) => `wa:${id}`));
  }
}

/**
 * CRM bookkeeping for a client with new WhatsApp activity:
 * - last contact (clients.last_engagement_at) moves forward, never back;
 * - a message from them marks them replied (clients.last_inbound_at);
 * - a live message from them stops the new-lead drip and pauses its unsent drafts.
 * "You haven't replied" items are computed from the activities themselves,
 * so her echo clears them with no extra write.
 */
async function applyEffects(
  supabase: SupabaseClient,
  agentId: string,
  clientId: string,
  e: Effect,
) {
  const update: Record<string, string> = {};
  if (!e.client.last_engagement_at || e.latest > e.client.last_engagement_at) update.last_engagement_at = e.latest;
  if (e.latestInbound && (!e.client.last_inbound_at || e.latestInbound > e.client.last_inbound_at)) update.last_inbound_at = e.latestInbound;
  if (e.liveInbound && !e.client.drip_paused_at) update.drip_paused_at = new Date().toISOString();
  if (Object.keys(update).length) {
    await supabase.from("clients").update(update).eq("id", clientId).eq("agent_id", agentId);
  }
  if (!e.liveInbound) return;

  // Unsent drip drafts (welcome / follow-up email / re-engage) no longer fit a live conversation.
  const { data: drafts } = await supabase
    .from("activities")
    .select("id, metadata")
    .eq("agent_id", agentId)
    .eq("client_id", clientId)
    .in("type", ["automation", "email"])
    .eq("ai_draft", true)
    .eq("approved", false)
    .eq("sent", false)
    .is("metadata->>paused", null);
  for (const d of drafts ?? []) {
    await supabase
      .from("activities")
      .update({ metadata: { ...((d.metadata as Record<string, unknown> | null) ?? {}), paused: "client_replied" } })
      .eq("id", d.id);
  }
}

/** Deletes "add as client?" cards past their 24 hours. */
export async function purgeExpiredUnknownCards(supabase: SupabaseClient, agentId?: string) {
  let q = supabase.from("whatsapp_unknown_senders").delete().lt("expires_at", new Date().toISOString());
  if (agentId) q = q.eq("agent_id", agentId);
  await q;
}
