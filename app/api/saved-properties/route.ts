import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import type { MlsListingPayload } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idsOnly = new URL(req.url).searchParams.get("idsOnly") === "1";

  const { data, error } = await supabase
    .from("user_saved_properties")
    .select(idsOnly ? "mls_number" : "*")
    .eq("agent_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (idsOnly) {
    const rows = (data ?? []) as { mls_number: string }[];
    return NextResponse.json({ mlsNumbers: rows.map((r) => r.mls_number) });
  }

  return NextResponse.json({ saved: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const listing = body.listing as MlsListingPayload | undefined;
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!listing?.mlsNumber) {
    return NextResponse.json(
      { error: "listing with mlsNumber required" },
      { status: 400 },
    );
  }

  const row = {
    agent_id: user.id,
    mls_number: listing.mlsNumber,
    address: listing.address || null,
    town: listing.city || null,
    price: listing.price || null,
    beds: listing.beds || null,
    baths: listing.baths || null,
    sqft: listing.sqft || null,
    photo_url: listing.photos?.[0] ?? null,
    status: listing.status || null,
    notes,
    snapshot: listing as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_saved_properties")
    .upsert(row, { onConflict: "agent_id,mls_number" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ saved: data });
}
