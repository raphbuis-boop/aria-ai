import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { mlsId: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mlsId = params.mlsId?.trim();
  if (!mlsId) {
    return NextResponse.json({ error: "mlsId required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_saved_properties")
    .delete()
    .eq("agent_id", user.id)
    .eq("mls_number", mlsId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { mlsId: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mlsId = params.mlsId?.trim();
  if (!mlsId) {
    return NextResponse.json({ error: "mlsId required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes : null;

  const { data, error } = await supabase
    .from("user_saved_properties")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("agent_id", user.id)
    .eq("mls_number", mlsId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ saved: data });
}
