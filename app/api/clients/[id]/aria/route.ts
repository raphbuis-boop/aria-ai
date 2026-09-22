import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead } from "@/lib/sms/lead";
import { sendClientSms } from "@/lib/sms/outbound";
import { closeAriaTasks } from "@/lib/sms/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/clients/[id]/aria  { action, body? }
 *  - "start":  Aria sends the first text to an existing client (manual lead).
 *  - "pause" / "resume": turn Aria's auto-replies off/on for this client.
 *  - "send":   the agent replies personally from the Aria number (so the
 *              client sees one thread); closes Aria's "needs you" tasks.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => ({}))) as { action?: string; body?: string };
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, agent_id, name, phone, email, sms_opted_out, lead_source, source")
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  switch (payload.action) {
    case "start": {
      const result = await ingestLead(admin, {
        agentId: user.id,
        source: "manual",
        name: client.name,
        phone: client.phone,
        email: client.email,
      });
      if (result.firstText === null) {
        return NextResponse.json({ error: "Aria is already texting this client" }, { status: 409 });
      }
      return NextResponse.json({ ok: result.firstText.ok, ...result }, { status: result.firstText.ok ? 200 : 400 });
    }
    case "pause":
    case "resume": {
      const aria_paused = payload.action === "pause";
      await admin.from("clients").update({ aria_paused }).eq("id", client.id);
      if (!aria_paused) await closeAriaTasks(admin, client.id, ["aria_handoff", "aria_client_texted"]);
      return NextResponse.json({ ok: true, aria_paused });
    }
    case "send": {
      const text = payload.body?.trim();
      if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
      const sent = await sendClientSms(admin, client, text.slice(0, 1000), {
        aiDraft: false,
        metadata: { kind: "agent_reply" },
      });
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 });
      await closeAriaTasks(admin, client.id, ["aria_handoff", "aria_client_texted", "aria_reply_failed", "aria_send_failed"]);
      return NextResponse.json(sent);
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
