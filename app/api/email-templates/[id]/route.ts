import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.subject === "string") patch.subject = body.subject.trim();
  if (typeof body.body === "string") patch.body = body.body;
  if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("email_templates")
    .update(patch)
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .select("id, name, subject, body, system_key, sort_order, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", params.id)
    .eq("agent_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
