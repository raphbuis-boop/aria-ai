import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", params.id)
    .eq("agent_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
