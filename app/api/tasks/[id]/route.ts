import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.done === "boolean") updates.done = body.done;
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.due_at !== undefined) updates.due_at = body.due_at ?? null;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .eq("agent_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
