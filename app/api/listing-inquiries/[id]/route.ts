import { getRouteSupabase } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = ["new", "contacted", "converted", "archived"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("idx_listing_inquiries")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[listing-inquiries PATCH]", error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/listing-inquiries/[id]/claim
 * Claims an unclaimed inquiry for the calling agent.
 * RLS enforces that only unclaimed rows can be claimed (USING clause checks
 * claimed_by_agent_id IS NULL), and WITH CHECK ensures the row is assigned
 * to the caller. The extra .is("claimed_by_agent_id", null) filter makes the
 * race condition explicit: if two agents hit this simultaneously, only one
 * will match the filter and get rowCount=1 back.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("idx_listing_inquiries")
    .update({
      claimed_by_agent_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("claimed_by_agent_id", null)
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[listing-inquiries claim]", error);
    return NextResponse.json({ error: "Claim failed." }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json(
      { error: "Inquiry already claimed or not found." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
