import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

type Slide = {
  title: string;
  subtitle: string;
  content: string;
  highlight: string;
};

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "");
  const town = String(body.town ?? "");
  const beds = Number(body.beds ?? 0);
  const baths = Number(body.baths ?? 0);
  const sqft = Number(body.sqft ?? 0);
  const priceMin = Number(body.priceMin ?? 0);
  const priceMax = Number(body.priceMax ?? 0);
  const sellerName = String(body.sellerName ?? "");
  const marketStats = body.marketStats ?? {};

  const system =
    "Generate 5-slide listing presentation for NJ agent using Aria. Return JSON only: { slides: [{ title, subtitle, content, highlight }] }";

  const userMsg = `Address: ${address}\nTown: ${town}\nBeds: ${beds}\nBaths: ${baths}\nSqft: ${sqft}\nPrice range: ${priceMin}-${priceMax}\nSeller: ${sellerName}\nMarket stats: ${JSON.stringify(marketStats)}`;

  const raw = await callClaude(system, userMsg, 2500);
  const parsed = safeJsonParse<{ slides: Slide[] }>(raw);

  let slides: Slide[] = parsed?.slides ?? [];

  if (!getAnthropic() || slides.length < 5) {
    slides = [
      {
        title: "Meet Aria",
        subtitle: "AI-powered listing strategy",
        content:
          "I combine local NJ expertise with Aria’s AI workflows — faster follow-ups, sharper pricing narratives, and marketing that actually converts.",
        highlight: "Your AI real estate teammate",
      },
      {
        title: "Buyer Profile",
        subtitle: "Who’s buying in this pocket",
        content: `In ${town}, today’s buyers are value-sensitive, pre-approved, and comparing condition vs. commute. Your home’s ${beds} bed / ${baths} bath layout matches the most active buyer segment.`,
        highlight: "Demand + fit",
      },
      {
        title: "Market Analysis",
        subtitle: "What the numbers say",
        content: `Using current market stats, pricing near $${priceMin.toLocaleString()}–$${priceMax.toLocaleString()} aligns with recent absorption and buyer expectations in ${town}.`,
        highlight: "Data-backed range",
      },
      {
        title: "AI-Recommended Listing Price",
        subtitle: "Balanced for speed + upside",
        content: `Recommended list strategy anchors near the middle of the range with room for negotiation, supported by comps and ${sqft.toLocaleString()} sqft positioning.`,
        highlight: "Strategic pricing",
      },
      {
        title: "The Aria Strategy",
        subtitle: "How we win the launch week",
        content:
          "Targeted outreach, SMS + social sequencing, showing feedback loops, and weekly pricing adjustments — all coordinated through Aria so nothing slips.",
        highlight: "Launch + iterate",
      },
    ];
  }

  return NextResponse.json({ slides });
}
