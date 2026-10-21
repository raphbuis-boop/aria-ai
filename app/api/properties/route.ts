import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { matchAndNotify } from "@/lib/matchProperties";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["available", "pending", "sold", "off_market"]);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * POST /api/properties { address, town, price?, beds?, baths?, sqft?, status?,
 *   photo?, description?, mlsNumber?, sourceUrl? }
 * Saves a home to the agent's properties — added by hand, from a pasted
 * listing link, or by MLS # — then runs client matching on it. A home with an
 * MLS # the agent already has is updated instead of duplicated.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const address = text(body.address, 200);
  const town = text(body.town, 80);
  if (!address || !town) {
    return NextResponse.json({ error: "Address and town are required" }, { status: 400 });
  }
  const mlsNumber = text(body.mlsNumber, 30)?.toUpperCase() ?? null;
  const photo = text(body.photo, 1000);
  const sourceUrl = text(body.sourceUrl, 1000);
  const description = text(body.description, 5000);
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "available";

  const row = {
    agent_id: user.id,
    address,
    town,
    price: num(body.price),
    beds: num(body.beds),
    baths: num(body.baths),
    sqft: num(body.sqft),
    status,
    mls_number: mlsNumber,
    photos: photo && /^https?:\/\//.test(photo) ? [photo] : [],
    // No column for the listing link — keep it with the description so it's one tap away.
    description:
      [description, sourceUrl && /^https:\/\//.test(sourceUrl) ? `Listing: ${sourceUrl}` : null].filter(Boolean).join("\n\n") ||
      null,
  };

  let propertyId: string | null = null;
  if (mlsNumber) {
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("agent_id", user.id)
      .eq("mls_number", mlsNumber)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("properties").update(row).eq("id", existing.id).eq("agent_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      propertyId = existing.id as string;
    }
  }
  if (!propertyId) {
    const { data: created, error } = await supabase.from("properties").insert(row).select("id").single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? "Couldn't save the home" }, { status: 400 });
    propertyId = created.id as string;
  }

  const matched = await matchAndNotify(supabase, user.id, propertyId, address);
  return NextResponse.json({ propertyId, matched });
}
