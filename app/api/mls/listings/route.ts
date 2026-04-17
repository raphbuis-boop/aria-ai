import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  mapSimplyRetsListing,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";
import type { MlsListingPayload } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";

export type { MlsListingPayload } from "@/lib/simplyrets";

function parseListingsPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.properties)) return o.properties;
    if (Array.isArray(o.listings)) return o.listings;
  }
  return [];
}

export async function GET(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSimplyRetsConfigured()) {
    return NextResponse.json(
      {
        error:
          "SimplyRETS is not configured. Set SIMPLYRETS_API_KEY and SIMPLYRETS_API_SECRET.",
        listings: [] as MlsListingPayload[],
        total: 0,
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? undefined;
  const state = url.searchParams.get("state") ?? "NJ";
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");
  const minBeds = url.searchParams.get("minBeds");
  const status = url.searchParams.get("status") ?? "Active";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );

  const base =
    process.env.SIMPLYRETS_API_URL?.replace(/\/$/, "") ?? SIMPLYRETS_API_BASE;

  const params = new URLSearchParams({
    status,
    limit: limit.toString(),
    ...(state && { state }),
    ...(city && { cities: city }),
    ...(minPrice && { minprice: minPrice }),
    ...(maxPrice && { maxprice: maxPrice }),
    ...(minBeds && { minbeds: minBeds }),
  });

  const endpoint = `${base}/properties?${params}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: getSimplyRetsAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      {
        error:
          errText?.slice(0, 500) || `SimplyRETS error (${response.status})`,
        listings: [] as MlsListingPayload[],
        total: 0,
      },
      { status: 502 },
    );
  }

  const data = (await response.json()) as unknown;
  const rawListings = parseListingsPayload(data);

  const listings: MlsListingPayload[] = rawListings.map((item) =>
    mapSimplyRetsListing(item as Record<string, unknown>),
  );

  return NextResponse.json({
    listings,
    total: listings.length,
  });
}
