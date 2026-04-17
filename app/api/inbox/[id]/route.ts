import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("agent_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
