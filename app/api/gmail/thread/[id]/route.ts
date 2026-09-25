import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmail } from "@/lib/gmail";
import { clientsByEmail, loadThread } from "@/lib/inbox/gmail-data";
import { parseAddress } from "@/lib/inbox/triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/gmail/thread/[id] — one thread from the agent's own mailbox. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const g = await getGmail(user.id);
  if (!g) return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });

  try {
    const thread = await loadThread(g.gmail, params.id, g.email);
    const clients = await clientsByEmail(supabase, user.id);
    const counterpart = [...thread.messages].reverse().find((m) => !m.fromMe);
    const emails = thread.messages.flatMap((m) => [m.from.email, ...m.to.split(",").map((t) => parseAddress(t).email)]);
    const client = emails.map((e) => clients.get(e)).find(Boolean) ?? null;
    return NextResponse.json({
      ...thread,
      agentEmail: g.email,
      replyTo: counterpart?.from ?? null,
      client: client ? { id: client.id, name: client.name } : null,
    });
  } catch (err) {
    console.error("[gmail/thread] failed:", (err as Error).message);
    return NextResponse.json({ error: "Couldn't load this email" }, { status: 502 });
  }
}
