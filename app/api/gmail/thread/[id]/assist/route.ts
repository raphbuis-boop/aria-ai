import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmail } from "@/lib/gmail";
import { clientsByEmail, loadThread } from "@/lib/inbox/gmail-data";
import { assistThread } from "@/lib/inbox/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/gmail/thread/[id]/assist — AI summary, why it matters, urgency
 * and a suggested reply. The thread is read server-side from the agent's own
 * mailbox; nothing from the request body reaches the prompt.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const g = await getGmail(user.id);
  if (!g) return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });

  let thread;
  try {
    thread = await loadThread(g.gmail, params.id, g.email);
  } catch (err) {
    console.error("[gmail/assist] load failed:", (err as Error).message);
    return NextResponse.json({ error: "Couldn't load this email" }, { status: 502 });
  }

  const [clients, { data: profile }] = await Promise.all([
    clientsByEmail(supabase, user.id),
    supabase.from("agent_profiles").select("full_name, signature, draft_tone").eq("id", user.id).maybeSingle(),
  ]);
  const client = thread.messages.map((m) => clients.get(m.from.email)).find(Boolean) ?? null;

  const assist = await assistThread({
    agentName: (profile?.full_name as string | null) ?? "",
    signature: (profile?.signature as string | null) ?? null,
    tone: (profile?.draft_tone as string | null) ?? null,
    client: client ? { name: client.name, status: client.status, town: client.town, budget_max: client.budget_max } : null,
    subject: thread.messages[0]?.subject ?? "",
    messages: thread.messages.slice(-8).map((m) => ({
      from: m.fromMe ? "Agent (me)" : `${m.from.name} <${m.from.email}>`,
      date: m.date,
      body: m.body.slice(0, 2500),
    })),
  });
  if (!assist) return NextResponse.json({ error: "Aria couldn't draft a reply right now" }, { status: 503 });
  return NextResponse.json(assist);
}
