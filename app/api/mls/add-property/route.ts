import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { runPropertyMatching } from "@/lib/matchProperties";
import { insertNotification } from "@/lib/notifications";
import type { MlsListingPayload } from "../listings/route";

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
  const listing = body.listing as MlsListingPayload | undefined;
  if (!listing?.mlsNumber) {
    return NextResponse.json({ error: "listing required" }, { status: 400 });
  }

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

  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("agent_id", user.id)
    .eq("mls_number", listing.mlsNumber)
    .maybeSingle();

  let propertyId: string;
  if (existing?.id) {
    await supabase.from("properties").update(row).eq("id", existing.id);
    propertyId = existing.id as string;
  } else {
    const { data: created, error } = await supabase
      .from("properties")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 400 });
    }
    propertyId = created.id as string;
  }

  const { matched } = await runPropertyMatching(supabase, user.id, propertyId);

  // Tell the agent when tracking a property surfaced client matches —
  // otherwise the matches sit unseen in the database.
  if (matched > 0) {
    await insertNotification(supabase, {
      agent_id: user.id,
      kind: "match_found",
      title: `${matched} client${matched === 1 ? "" : "s"} matched to ${listing.address ?? "a new listing"}`,
      body: "Review the matches and reach out while it's fresh.",
      related_listing_id: propertyId,
      dedup_key: `match_found::${propertyId}`,
    });
  }

  return NextResponse.json({ propertyId, matched });
}
