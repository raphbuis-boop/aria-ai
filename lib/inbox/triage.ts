import type { gmail_v1 } from "googleapis";

/** Rules that decide what the Aria inbox shows first. No I/O — unit-testable. */

export type Header = { name?: string | null; value?: string | null };

export function header(headers: Header[] | undefined, name: string): string {
  const n = name.toLowerCase();
  return headers?.find((h) => h.name?.toLowerCase() === n)?.value ?? "";
}

export function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/<([^>]+)>/);
  const email = (m ? m[1] : raw).trim().toLowerCase();
  const name = raw.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || email;
  return { name, email };
}

const BULK_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS", "SPAM"];
const NO_REPLY_SENDER =
  // Deliberately excludes info@/hello@/team@ — small offices (title, lenders) write from those.
  /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|notifications?|notify|mailer-daemon|postmaster|bounces?|newsletters?|marketing|promo(tions)?|alerts?|digest|receipts?)([._+-]|@)/i;

/**
 * Why a message is automated/bulk (newsletter, promotion, notification,
 * no-reply), or null when it looks like a person wrote it.
 */
export function bulkReason(
  labelIds: string[] | null | undefined,
  headers: Header[] | undefined,
  fromEmail: string,
): string | null {
  const labels = labelIds ?? [];
  if (labels.includes("CATEGORY_PROMOTIONS")) return "Promotion";
  if (labels.includes("CATEGORY_SOCIAL")) return "Social";
  if (labels.some((l) => BULK_LABELS.includes(l))) return "Notification";
  const precedence = header(headers, "Precedence").toLowerCase();
  if (["bulk", "list", "junk"].includes(precedence)) return "Mailing list";
  const auto = header(headers, "Auto-Submitted").toLowerCase();
  if (auto && auto !== "no") return "Automated";
  if (header(headers, "List-Unsubscribe") || header(headers, "List-Id")) return "Newsletter";
  if (NO_REPLY_SENDER.test(fromEmail)) return "No-reply sender";
  return null;
}

export type ClientRef = { id: string; name: string };

export type InboxThread = {
  threadId: string;
  lastMessageId: string;
  subject: string;
  snippet: string;
  date: string;
  from: { name: string; email: string };
  unread: boolean;
  messageCount: number;
  client: ClientRef | null;
  /** Last message is from someone else and is a real person → the agent owes a reply. */
  needsReply: boolean;
  /** Set when the thread is a newsletter/promotion/notification. */
  lowReason: string | null;
  /** Hours since the last message. */
  ageHours: number;
  priority: number;
};

/** Builds a triaged row from a Gmail thread fetched with format=metadata. */
export function triageThread(
  thread: gmail_v1.Schema$Thread,
  agentEmail: string,
  clientByEmail: Map<string, ClientRef>,
  now = Date.now(),
): InboxThread | null {
  const messages = thread.messages ?? [];
  const last = messages.at(-1);
  if (!thread.id || !last?.id) return null;
  const headers = last.payload?.headers ?? [];
  const from = parseAddress(header(headers, "From"));
  const lastFromMe =
    (last.labelIds ?? []).includes("SENT") || (agentEmail !== "" && from.email === agentEmail);

  // The client is whoever the agent is corresponding with — sender, or the
  // recipient when the agent wrote last.
  const participants = new Set<string>();
  for (const m of messages) {
    const h = m.payload?.headers ?? [];
    for (const field of ["From", "To", "Cc"]) {
      for (const part of header(h, field).split(",")) {
        const e = parseAddress(part).email;
        if (e && e !== agentEmail) participants.add(e);
      }
    }
  }
  let client: ClientRef | null = clientByEmail.get(from.email) ?? null;
  if (!client) for (const e of participants) if ((client = clientByEmail.get(e) ?? null)) break;

  const lowReason = client ? null : bulkReason(last.labelIds, headers, from.email);
  const internal = Number(last.internalDate ?? 0);
  const ageHours = internal ? Math.max(0, (now - internal) / 3_600_000) : 999;
  const unread = messages.some((m) => (m.labelIds ?? []).includes("UNREAD"));
  const needsReply = !lastFromMe && !lowReason;

  // Clients first, then threads owed a reply; unread and fresh float up.
  let priority = 0;
  if (client) priority += 100;
  if (needsReply) priority += 50;
  if (unread) priority += 10;
  priority += Math.max(0, 20 - ageHours / 12);
  if (lowReason) priority -= 200;

  return {
    threadId: thread.id,
    lastMessageId: last.id,
    subject: header(headers, "Subject") || "(no subject)",
    snippet: decodeEntities(last.snippet ?? ""),
    date: internal ? new Date(internal).toISOString() : header(headers, "Date"),
    from: lastFromMe ? { name: "You", email: agentEmail } : from,
    unread,
    messageCount: messages.length,
    client,
    needsReply,
    lowReason,
    ageHours,
    priority,
  };
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Plain-text body of a Gmail message (text/plain preferred, else stripped HTML). */
export function messageText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const decode = (d?: string | null) => (d ? Buffer.from(d, "base64url").toString("utf-8") : "");
  const find = (p: gmail_v1.Schema$MessagePart, mime: string): string => {
    if (p.mimeType === mime && p.body?.data) return decode(p.body.data);
    for (const c of p.parts ?? []) {
      const r = find(c, mime);
      if (r) return r;
    }
    return "";
  };
  const text = find(payload, "text/plain");
  if (text) return text;
  const html = find(payload, "text/html");
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Drops the quoted history ("On … wrote:" and "> " lines) from a reply. */
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:$/.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}
