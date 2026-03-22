import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export type MlsListingPayload = {
  id: string;
  address: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  photos: string[];
  status: string;
  daysOnMarket: number | null;
  mlsNumber: string;
};

function mapListing(raw: Record<string, unknown>): MlsListingPayload {
  const address = (raw.address as Record<string, unknown> | undefined) ?? {};
  const property = (raw.property as Record<string, unknown> | undefined) ?? {};
  const mls = (raw.mls as Record<string, unknown> | undefined) ?? {};
  const photosRaw = raw.photos;
  const photos = Array.isArray(photosRaw)
    ? (photosRaw as string[])
    : typeof photosRaw === "string"
      ? [photosRaw]
      : [];

  const mlsId = String(raw.mlsId ?? raw.id ?? "");

  return {
    id: mlsId,
    address: String(address.full ?? address.street ?? ""),
    city: String(address.city ?? ""),
    price: Number(raw.listPrice ?? 0),
    beds: Number(property.bedrooms ?? 0),
    baths: Number(property.bathsFull ?? property.bathsTotal ?? 0),
    sqft: Number(property.area ?? property.livingArea ?? 0),
    description: String(raw.remarks ?? raw.publicRemarks ?? ""),
    photos,
    status: String(mls.status ?? raw.status ?? "Active"),
    daysOnMarket:
      mls.daysOnMarket != null ? Number(mls.daysOnMarket) : null,
    mlsNumber: mlsId,
  };
}

export async function GET(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? undefined;
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");
  const minBeds = url.searchParams.get("minBeds");
  const status = url.searchParams.get("status") ?? "Active";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );

  const key = process.env.SIMPLYRETS_API_KEY ?? "";
  const secret = process.env.SIMPLYRETS_API_SECRET ?? "";
  const base =
    process.env.SIMPLYRETS_API_URL?.replace(/\/$/, "") ??
    "https://api.simplyrets.com";

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  const params = new URLSearchParams({
    status,
    limit: limit.toString(),
    ...(city && { cities: city }),
    ...(minPrice && { minprice: minPrice }),
    ...(maxPrice && { maxprice: maxPrice }),
    ...(minBeds && { minbeds: minBeds }),
  });

  const response = await fetch(`${base}/properties?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: errText || "SimplyRETS request failed", listings: [], total: 0 },
      { status: 502 },
    );
  }

  const data = (await response.json()) as unknown;
  const rawListings = Array.isArray(data) ? data : [];

  const listings: MlsListingPayload[] = rawListings.map((item) =>
    mapListing(item as Record<string, unknown>),
  );

  return NextResponse.json({
    listings,
    total: listings.length,
  });
}
