import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

type Nar = {
  mls_description: string;
  instagram_funny: string;
  instagram_professional: string;
  instagram_teaser: string;
  sms_blast: string;
};

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "");
  const price = Number(body.price ?? 0);
  const beds = Number(body.beds ?? 0);
  const baths = Number(body.baths ?? 0);
  const sqft = Number(body.sqft ?? 0);

  const system =
    "Generate real estate marketing content. Return JSON only: { mls_description, instagram_funny, instagram_professional, instagram_teaser, sms_blast }";

  const userMsg = `Address: ${address}\nPrice: ${price}\nBeds: ${beds}\nBaths: ${baths}\nSqft: ${sqft}`;

  const raw = await callClaude(system, userMsg, 1200);
  let parsed = safeJsonParse<Nar>(raw);

  if (!getAnthropic() || !parsed) {
    parsed = {
      mls_description: `Welcome to ${address} — a thoughtfully updated ${beds} bed / ${baths} bath home offering ${sqft.toLocaleString()} sqft of living space. Sun-filled rooms, a practical floor plan, and strong curb appeal make this a standout in its price range at $${price.toLocaleString()}.`,
      instagram_funny: `This one’s basically begging for a pizza night on the porch 🍕 ${address} — ${beds} beds, big vibes.`,
      instagram_professional: `Just listed: ${address}. ${beds} BR | ${baths} BA | ${sqft.toLocaleString()} sqft. DM for a private tour.`,
      instagram_teaser: `New listing alert near everything you love — details inside.`,
      sms_blast: `New listing: ${address} — $${price.toLocaleString()}. Want the tour link? Reply YES.`,
    };
  }

  return NextResponse.json(parsed);
}
