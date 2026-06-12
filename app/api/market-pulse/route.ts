import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  mapSimplyRetsListing,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";

export const dynamic = "force-dynamic";

const NJ_TOWNS = [
  "Ridgewood",
  "Montclair",
  "Summit",
  "Hoboken",
  "Westfield",
  "Short Hills",
  "Maplewood",
] as const;

function parseListingsPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.properties)) return o.properties;
  }
  return [];
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type TownPulse = {
  town: string;
  activeCount: number;
  medianPrice: number | null;
  avgDaysOnMarket: number | null;
  /** Rough momentum: median price of newer listings (DOM ≤14) vs older (>14), if both exist. */
  momentumPct: number | null;
};

export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSimplyRetsConfigured()) {
    return NextResponse.json(
      {
        error: "SimplyRETS not configured",
        towns: [] as TownPulse[],
      },
      { status: 503 },
    );
  }

  const base =
    process.env.SIMPLYRETS_API_URL?.replace(/\/$/, "") ?? SIMPLYRETS_API_BASE;
  const auth = getSimplyRetsAuthHeader();

  async function fetchTown(city: string) {
    const params = new URLSearchParams({
      state: "NJ",
      cities: city,
      status: "Active",
      limit: "200",
    });
    let res: Response;
    try {
      res = await fetch(`${base}/properties?${params}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
      });
    } catch {
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json();
    return parseListingsPayload(data) as Record<string, unknown>[];
  }

  const towns: TownPulse[] = [];

  for (const town of NJ_TOWNS) {
    const currentRaw = await fetchTown(town);
    const current = currentRaw.map((r) => mapSimplyRetsListing(r));
    const prices = current.map((l) => l.price).filter((p) => p > 0);
    const doms = current
      .map((l) => l.daysOnMarket)
      .filter((d): d is number => d != null && d >= 0);

    const fresh = current.filter(
      (l) => l.daysOnMarket != null && l.daysOnMarket <= 14,
    );
    const aged = current.filter(
      (l) => l.daysOnMarket != null && l.daysOnMarket > 14,
    );
    const medFresh = median(fresh.map((l) => l.price).filter((p) => p > 0));
    const medAged = median(aged.map((l) => l.price).filter((p) => p > 0));
    let momentumPct: number | null = null;
    if (medFresh != null && medAged != null && medAged > 0) {
      momentumPct =
        Math.round(((medFresh - medAged) / medAged) * 1000) / 10;
    }

    towns.push({
      town,
      activeCount: current.length,
      medianPrice: median(prices),
      avgDaysOnMarket: average(doms),
      momentumPct,
    });
  }

  return NextResponse.json({ towns });
}
