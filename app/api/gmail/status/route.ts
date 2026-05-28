import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("gmail_integrations")
    .select("email")
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({ connected: true, email: data.email });
}
