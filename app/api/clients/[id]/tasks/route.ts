import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const due_at = body.due_at ? String(body.due_at) : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({ client_id: params.id, agent_id: user.id, title, due_at })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
