import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmailClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Lists the agent's recent primary-inbox emails and tags any whose sender is a
// known client — so the agent sees mail coming in, money-first (which are clients).
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gmail = await getGmailClient(user.id);
  if (!gmail) return NextResponse.json({ connected: false, messages: [] });

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox category:primary",
      maxResults: 25,
    });
  } catch (err) {
    console.error("[gmail/inbox] list failed:", err);
    return NextResponse.json({ connected: true, messages: [], error: "fetch_failed" });
  }

  const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ connected: true, messages: [] });

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("agent_id", user.id)
    .not("email", "is", null);
  const clientByEmail = new Map<string, { id: string; name: string }>();
  for (const c of (clientRows ?? []) as { id: string; name: string | null; email: string | null }[]) {
    if (c.email) clientByEmail.set(c.email.toLowerCase(), { id: c.id, name: c.name ?? "Client" });
  }

  const messages = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = res.data.payload?.headers ?? [];
        const get = (n: string) =>
          headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
        const from = get("From");
        const m = from.match(/<([^>]+)>/);
        const senderEmail = (m ? m[1] : from).trim().toLowerCase();
        const senderName =
          from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || senderEmail;
        return {
          id,
          senderName,
          senderEmail,
          subject: get("Subject") || "(no subject)",
          date: get("Date"),
          snippet: res.data.snippet ?? "",
          unread: (res.data.labelIds ?? []).includes("UNREAD"),
          client: clientByEmail.get(senderEmail) ?? null,
        };
      } catch {
        return null;
      }
    }),
  );

  return NextResponse.json({ connected: true, messages: messages.filter(Boolean) });
}
