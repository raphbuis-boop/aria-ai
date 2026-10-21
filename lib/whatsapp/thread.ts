import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
  mediaType: string | null;
};

/** Placeholder text for a message with no caption: "[Photo]", "[Voice message]"… */
export const MEDIA_LABELS: Record<string, string> = {
  image: "Photo",
  video: "Video",
  audio: "Voice message",
  document: "Document",
  sticker: "Sticker",
  location: "Location",
  contacts: "Contact card",
  reaction: "Reaction",
  // History backfill: media the sync didn't include.
  media_placeholder: "Media",
};

/** The client's WhatsApp thread, oldest first (the last `limit` messages). */
export async function loadWhatsAppThread(
  supabase: SupabaseClient,
  agentId: string,
  clientId: string,
  limit = 30,
): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, direction, body, created_at, metadata")
    .eq("agent_id", agentId)
    .eq("client_id", clientId)
    .eq("type", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((a) => ({
      id: String(a.id),
      direction: a.direction === "inbound" ? ("inbound" as const) : ("outbound" as const),
      body: (a.body as string | null) ?? null,
      created_at: a.created_at as string,
      mediaType: ((a.metadata as { media_type?: string } | null)?.media_type as string | undefined) ?? null,
    }))
    .reverse();
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Dana (Oct 21, 3:04 PM): Is the Teaneck one still available?" — for prompts. */
export function renderThread(messages: WhatsAppMessage[], clientFirstName: string, maxChars = 6000): string {
  const lines = messages.map((m) => {
    const who = m.direction === "inbound" ? clientFirstName : "Agent";
    const text = m.body?.trim() || `[${MEDIA_LABELS[m.mediaType ?? ""] ?? "Attachment"}]`;
    return `${who} (${stamp(m.created_at)}): ${text.replace(/\s+/g, " ")}`;
  });
  // Keep the most recent lines that fit.
  const out: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    used += lines[i].length + 1;
    if (used > maxChars) break;
    out.unshift(lines[i]);
  }
  return out.join("\n");
}
