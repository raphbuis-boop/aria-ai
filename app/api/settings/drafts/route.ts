import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_TONES = ["warm", "professional", "direct", "casual"] as const;

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("agent_profiles")
    .select("draft_tone, signature")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    draftTone: (data?.draft_tone as string | undefined) ?? "warm",
    signature: (data?.signature as string | undefined) ?? "",
  });
}

export async function PATCH(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.draftTone === "string") {
    if (!VALID_TONES.includes(body.draftTone as (typeof VALID_TONES)[number])) {
      return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
    }
    update.draft_tone = body.draftTone;
  }
  if (typeof body.signature === "string") {
    update.signature = body.signature.trim().slice(0, 200) || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("agent_profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
