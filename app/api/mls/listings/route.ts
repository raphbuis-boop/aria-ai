import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  describeSimplyRetsEnv,
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  mapSimplyRetsListing,
  MLS_SORT_PARAM,
  resolveSimplyRetsCredentials,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";
import type { MlsListingPayload } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const envSummary = describeSimplyRetsEnv();

  if (!isSimplyRetsConfigured()) {
    console.error("[mls] SimplyRETS not configured", envSummary);
    return NextResponse.json(
      {
        error:
          "SimplyRETS is not configured. Set one of the accepted credential pairs in your Vercel env vars (see /api/mls-test).",
        env: envSummary,
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
  const minBaths = url.searchParams.get("minBaths");
  const minSqft = url.searchParams.get("minSqft");
  const propertyType = url.searchParams.get("propertyType"); // SimplyRETS: "type"
  const status = url.searchParams.get("status") ?? "Active";
  const sortRaw = url.searchParams.get("sort");
  const sortKey = url.searchParams.get("sortKey") ?? "";
  const sortFromKey = MLS_SORT_PARAM[sortKey] ?? null;
  const sort = sortRaw || sortFromKey || undefined;
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
    SIMPLYRETS_API_BASE;

  const params = new URLSearchParams({
    status,
    limit: limit.toString(),
    offset: offset.toString(),
    ...(state && { state }),
    ...(city && { cities: city }),
    ...(minPrice && { minprice: minPrice }),
    ...(maxPrice && { maxprice: maxPrice }),
    ...(minBeds && { minbeds: minBeds }),
    ...(minBaths && { minbaths: minBaths }),
    ...(minSqft && { minarea: minSqft }),
    ...(propertyType && { type: propertyType }),
    ...(sort ? { sort } : {}),
  });

  const endpoint = `${base}/properties?${params}`;

  console.log("[mls] calling SimplyRETS", {
    endpoint,
    credentialSource: resolveSimplyRetsCredentials()?.source,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Authorization: getSimplyRetsAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mls] fetch threw", { endpoint, message });
    return NextResponse.json(
      {
        error: `Network error calling SimplyRETS: ${message}`,
        endpoint,
        env: envSummary,
        listings: [] as MlsListingPayload[],
        total: 0,
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("[mls] SimplyRETS non-2xx", {
      endpoint,
      status: response.status,
      body: errText.slice(0, 500),
    });
    return NextResponse.json(
      {
        error:
          errText?.slice(0, 500) || `SimplyRETS error (${response.status})`,
        status: response.status,
        endpoint,
        env: envSummary,
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

  // SimplyRETS returns total results in the X-Total-Count header.
  const totalHeader = response.headers.get("x-total-count");
  const total = totalHeader != null ? Number(totalHeader) : null;
  const hasMore =
    total != null
      ? offset + listings.length < total
      : listings.length === limit;

  console.log("[mls] SimplyRETS ok", {
    endpoint,
    status: response.status,
    count: listings.length,
    total,
    offset,
    hasMore,
  });

  return NextResponse.json({
    listings,
    /** Total count when SimplyRETS sends X-Total-Count; omit otherwise. */
    total,
    offset,
    limit,
    hasMore,
  });
}
