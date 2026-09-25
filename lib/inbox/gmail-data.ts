import type { gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { header, messageText, parseAddress, stripQuoted, type ClientRef } from "@/lib/inbox/triage";

/** The agent's clients keyed by lowercased email. Scoped to that agent only. */
export async function clientsByEmail(supabase: SupabaseClient, agentId: string) {
  const { data } = await supabase
    .from("clients")
    .select("id, name, email, status, town, budget_max")
    .eq("agent_id", agentId)
    .not("email", "is", null);
  const map = new Map<string, ClientRef & { status: string | null; town: string | null; budget_max: number | null }>();
  for (const c of data ?? []) {
    if (c.email) {
      map.set(String(c.email).trim().toLowerCase(), {
        id: String(c.id),
        name: (c.name as string | null) ?? "Client",
        status: (c.status as string | null) ?? null,
        town: (c.town as string | null) ?? null,
        budget_max: (c.budget_max as number | null) ?? null,
      });
    }
  }
  return map;
}

export type ThreadMessage = {
  id: string;
  messageIdHeader: string;
  references: string;
  from: { name: string; email: string };
  to: string;
  date: string;
  subject: string;
  body: string;
  fromMe: boolean;
};

/** Full thread from the agent's own mailbox (Gmail scopes this to "me"). */
export async function loadThread(gmail: gmail_v1.Gmail, threadId: string, agentEmail: string) {
  const res = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  const messages: ThreadMessage[] = (res.data.messages ?? []).map((m) => {
    const h = m.payload?.headers ?? [];
    const from = parseAddress(header(h, "From"));
    return {
      id: m.id ?? "",
      messageIdHeader: header(h, "Message-ID") || header(h, "Message-Id"),
      references: header(h, "References"),
      from,
      to: header(h, "To"),
      date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : header(h, "Date"),
      subject: header(h, "Subject"),
      body: stripQuoted(messageText(m.payload)).slice(0, 6000),
      fromMe: (m.labelIds ?? []).includes("SENT") || from.email === agentEmail,
    };
  });
  return { threadId: res.data.id ?? threadId, messages };
}
