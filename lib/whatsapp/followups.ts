import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Client messaged you, you haven't replied": a client's most recent real
 * contact is a WhatsApp message from them, older than the agent's alert
 * threshold. Any reply she makes afterwards (a WhatsApp message from her
 * phone, a text, an email, a logged call) clears it. Pure, so the Today and
 * Follow-ups pages and tests share it.
 */

export type ContactRow = {
  client_id: string;
  type: string | null;
  direction: string | null;
  body: string | null;
  ai_draft: boolean | null;
  sent: boolean | null;
  created_at: string;
};

export type AwaitingReply = {
  clientId: string;
  /** When the unanswered run of messages started. */
  since: string;
  /** First line of their latest message. */
  preview: string | null;
};

const MESSAGE_TYPES = new Set(["text", "sms", "whatsapp", "email"]);

/** Default for agent_profiles.whatsapp_reply_alert_hours. */
export const DEFAULT_REPLY_ALERT_HOURS = 4;

/** The agent's alert threshold (Settings → WhatsApp). Fail-soft: the default if unset or unreadable. */
export async function loadReplyAlertHours(supabase: SupabaseClient, agentId: string): Promise<number> {
  const { data } = await supabase.from("agent_profiles").select("whatsapp_reply_alert_hours").eq("id", agentId).maybeSingle();
  const h = Number((data as { whatsapp_reply_alert_hours?: unknown } | null)?.whatsapp_reply_alert_hours);
  return Number.isFinite(h) && h >= 1 ? h : DEFAULT_REPLY_ALERT_HOURS;
}

/** Contact that actually happened: not an unsent draft, not a note. */
export function isRealContact(a: Pick<ContactRow, "type" | "direction" | "ai_draft" | "sent">): boolean {
  if (a.direction === "inbound") return MESSAGE_TYPES.has(a.type ?? "");
  if (a.ai_draft && !a.sent) return false;
  if (MESSAGE_TYPES.has(a.type ?? "")) return Boolean(a.sent);
  return a.type === "call" || a.type === "showing";
}

export function firstLine(body: string | null, max = 140): string | null {
  const line = (body ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function findAwaitingReplies(rows: ContactRow[], alertHours: number, now: Date = new Date()): AwaitingReply[] {
  const byClient = new Map<string, ContactRow[]>();
  for (const r of rows) {
    if (!isRealContact(r)) continue;
    const list = byClient.get(r.client_id) ?? [];
    list.push(r);
    byClient.set(r.client_id, list);
  }
  const out: AwaitingReply[] = [];
  const cutoff = now.getTime() - alertHours * 3_600_000;
  for (const [clientId, list] of byClient) {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = list[0];
    if (latest.direction !== "inbound" || latest.type !== "whatsapp") continue;
    // The unanswered run: every message from them since her last reply.
    let since = latest.created_at;
    for (const r of list) {
      if (r.direction !== "inbound") break;
      since = r.created_at;
    }
    if (new Date(since).getTime() > cutoff) continue;
    out.push({ clientId, since, preview: firstLine(latest.body) });
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}
