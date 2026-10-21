import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, LeadError } from "@/lib/sms/lead";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST   /api/whatsapp/unknown/[id] { name? } — add the sender as a client
 *        (same intake as Quick add, never texted). Their first line is kept
 *        on the new client's WhatsApp thread; from now on their messages are too.
 * DELETE /api/whatsapp/unknown/[id] — dismiss: the card is deleted.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: card } = await supabase
    .from("whatsapp_unknown_senders")
    .select("id, phone, first_line, message_id, received_at")
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!card) return NextResponse.json({ error: "That card expired" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

  try {
    const lead = await ingestLead(createAdminClient(), {
      agentId: user.id,
      source: "manual",
      name: name || String(card.phone),
      phone: String(card.phone),
      autoText: false,
      origin: "WhatsApp",
    });
    if (lead.created && card.message_id) {
      await supabase.from("activities").insert({
        client_id: lead.clientId,
        agent_id: user.id,
        type: "whatsapp",
        direction: "inbound",
        body: card.first_line,
        ai_draft: false,
        approved: true,
        sent: true,
        external_id: `wa:${card.message_id}`,
        created_at: card.received_at,
        metadata: { channel: "whatsapp", source: "message" },
      });
      await supabase
        .from("clients")
        .update({ last_engagement_at: card.received_at, last_inbound_at: card.received_at })
        .eq("id", lead.clientId)
        .eq("agent_id", user.id);
    }
    await supabase.from("whatsapp_unknown_senders").delete().eq("id", card.id).eq("agent_id", user.id);
    return NextResponse.json({ clientId: lead.clientId, created: lead.created });
  } catch (error) {
    if (error instanceof LeadError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Couldn't add the client" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabase.from("whatsapp_unknown_senders").delete().eq("id", params.id).eq("agent_id", user.id);
  return NextResponse.json({ ok: true });
}
