import { NextResponse } from "next/server";
import { isProduction } from "@/lib/runtime-env";
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

/** Public read access allowed for NJMLS IDX; no user secrets in response. */
export async function GET(req: Request) {
  const envSummary = describeSimplyRetsEnv();

  if (!isSimplyRetsConfigured()) {
    console.error("[mls] SimplyRETS not configured", envSummary);
    return NextResponse.json(
      {
        error: isProduction()
          ? "Listing search is temporarily unavailable."
          : "SimplyRETS is not configured. Set credential env vars (see /api/mls-test when diagnostics are enabled).",
        listings: [] as MlsListingPayload[],
        total: 0,
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const city = url.searchParams.get("city")?.trim() || undefined;
  const state = url.searchParams.get("state")?.trim() || undefined;
  const minPrice = url.searchParams.get("minPrice")?.trim() || undefined;
  const maxPrice = url.searchParams.get("maxPrice")?.trim() || undefined;
  const minBeds = url.searchParams.get("minBeds")?.trim() || undefined;
  const minBaths = url.searchParams.get("minBaths")?.trim() || undefined;
  const minSqft = url.searchParams.get("minSqft")?.trim() || undefined;
  const propertyType = url.searchParams.get("propertyType")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || "Active";
  const sortRaw = url.searchParams.get("sort")?.trim() || undefined;
  const sortKey = url.searchParams.get("sortKey")?.trim() ?? "";
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

  const params = new URLSearchParams();
  params.set("status", status);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (state) params.set("state", state);
  if (city) params.set("cities", city);
  if (minPrice) params.set("minprice", minPrice);
  if (maxPrice) params.set("maxprice", maxPrice);
  if (minBeds) params.set("minbeds", minBeds);
  if (minBaths) params.set("minbaths", minBaths);
  if (minSqft) params.set("minarea", minSqft);
  if (propertyType) params.set("type", propertyType);
  if (sort) params.set("sort", sort);

  const paramSnapshot = Object.fromEntries(params.entries());
  const endpoint = `${base}/properties?${params.toString()}`;

  if (!isProduction()) {
    console.log("[mls] SimplyRETS request", {
      params: paramSnapshot,
      endpoint,
      credentialSource: resolveSimplyRetsCredentials()?.source,
    });
  }

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
        error: "Could not load listings. Please try again shortly.",
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
        error: "Could not load listings. Please try again shortly.",
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

  if (!isProduction()) {
    console.log("[mls] SimplyRETS ok", {
      endpoint,
      status: response.status,
      count: listings.length,
      total,
      offset,
      hasMore,
    });
  }

  return NextResponse.json({
    listings,
    /** Total count when SimplyRETS sends X-Total-Count; omit otherwise. */
    total,
    offset,
    limit,
    hasMore,
  });
}
