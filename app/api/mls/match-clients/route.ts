import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  scoreMatch,
  type ClientRow,
  type PropertyRow,
} from "@/lib/matchProperties";
import type { MlsListingPayload } from "../listings/route";

const ACTIVE = new Set([
  "new",
  "contacted",
  "showing",
  "offer",
  "under_contract",
]);

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const listing = body.listing as MlsListingPayload | undefined;
  if (!listing) {
    return NextResponse.json({ matches: [] });
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id);

  const prop: PropertyRow = {
    id: "mls-preview",
    price: listing.price,
    town: listing.city,
    beds: listing.beds,
    baths: listing.baths,
  };

  const matches: {
    clientId: string;
    name: string | null;
    phone: string | null;
    score: number;
    reasons: string[];
  }[] = [];

  for (const raw of clients ?? []) {
    const c = raw as ClientRow;
    if (!c.status || !ACTIVE.has(c.status)) continue;
    const { score, reasons } = scoreMatch(c, prop);
    if (score < 40) continue;
    matches.push({
      clientId: c.id,
      name: (raw as { name?: string | null }).name ?? null,
      phone: (raw as { phone?: string | null }).phone ?? null,
      score,
      reasons: reasons.map((r) => r.reason),
    });
  }

  matches.sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
