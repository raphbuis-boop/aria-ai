import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/gmail/default-templates";

export const dynamic = "force-dynamic";

async function ensureSeeded(agentId: string): Promise<void> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_EMAIL_TEMPLATES.map((t) => ({
    agent_id: agentId,
    name: t.name,
    subject: t.subject,
    body: t.body,
    system_key: t.system_key,
    sort_order: t.sort_order,
  }));
  await admin.from("email_templates").insert(rows);
}

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSeeded(user.id);

  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, subject, body, system_key, sort_order, updated_at")
    .eq("agent_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const bodyHtml = String(body.body ?? "");

  if (!name || !subject || !bodyHtml.trim()) {
    return NextResponse.json(
      { error: "name, subject, and body are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      agent_id: user.id,
      name,
      subject,
      body: bodyHtml,
      sort_order: 100,
    })
    .select("id, name, subject, body, system_key, sort_order, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: data });
}
