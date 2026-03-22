import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { scoreMatch, type ClientRow, type PropertyRow } from "@/lib/matchProperties";
import type { MlsListingPayload } from "../listings/route";

const ACTIVE = new Set([
  "new",
  "contacted",
  "showing",
  "offer",
  "under_contract",
]);

function mapMlsStatusToPropertyStatus(
  mls: string,
): "available" | "pending" | "sold" | "off_market" {
  const s = mls.toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("sold") || s.includes("closed")) return "sold";
  if (s.includes("off")) return "off_market";
  return "available";
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const listings = (body.listings ?? []) as MlsListingPayload[];
  if (!Array.isArray(listings) || !listings.length) {
    return NextResponse.json({ inserted: 0, newMatches: 0 });
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id);

  const clientRows = (clients ?? []) as ClientRow[];
  let newMatches = 0;

  for (const listing of listings) {
    if (!listing.mlsNumber) continue;

    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("agent_id", user.id)
      .eq("mls_number", listing.mlsNumber)
      .maybeSingle();

    let propertyId = existing?.id as string | undefined;

    const row = {
      agent_id: user.id,
      address: listing.address,
      town: listing.city,
      price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      description: listing.description,
      mls_number: listing.mlsNumber,
      photos: listing.photos,
      status: mapMlsStatusToPropertyStatus(listing.status),
    };

    if (propertyId) {
      await supabase.from("properties").update(row).eq("id", propertyId);
    } else {
      const { data: created, error } = await supabase
        .from("properties")
        .insert(row)
        .select("id")
        .single();
      if (error) continue;
      propertyId = created.id;
    }

    if (!propertyId) continue;

    const propRow: PropertyRow = {
      id: propertyId,
      price: listing.price,
      town: listing.city,
      beds: listing.beds,
      baths: listing.baths,
    };

    for (const c of clientRows) {
      if (!c.status || !ACTIVE.has(c.status)) continue;
      const { score, reasons } = scoreMatch(c, propRow);
      if (score < 40) continue;

      const { data: dup } = await supabase
        .from("property_matches")
        .select("id")
        .eq("property_id", propertyId)
        .eq("client_id", c.id)
        .maybeSingle();

      if (dup) continue;

      await supabase.from("property_matches").insert({
        property_id: propertyId,
        client_id: c.id,
        agent_id: user.id,
        match_score: score,
        match_reasons: reasons.map((r) => r.reason),
        notified: false,
      });
      newMatches += 1;
    }
  }

  return NextResponse.json({
    inserted: listings.length,
    newMatches,
  });
}
