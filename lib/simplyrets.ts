/**
 * SimplyRETS live MLS API — https://api.simplyrets.com/properties
 * Auth: Basic (SIMPLYRETS_API_KEY:SIMPLYRETS_API_SECRET)
 */

export const SIMPLYRETS_API_BASE = "https://api.simplyrets.com";

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

export function isSimplyRetsConfigured(): boolean {
  return Boolean(
    process.env.SIMPLYRETS_API_KEY?.trim() &&
      process.env.SIMPLYRETS_API_SECRET?.trim(),
  );
}

export function getSimplyRetsAuthHeader(): string {
  const key = process.env.SIMPLYRETS_API_KEY ?? "";
  const secret = process.env.SIMPLYRETS_API_SECRET ?? "";
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

function normalizePhotos(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const p of photos) {
    if (typeof p === "string" && p) {
      out.push(p);
      continue;
    }
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const href = o.href ?? o.url ?? o.uri ?? o.full;
      if (typeof href === "string" && href) out.push(href);
    }
  }
  return out;
}

function pickAddressLine(addr: Record<string, unknown>): string {
  const full = addr.full;
  if (typeof full === "string" && full.trim()) return full.trim();
  const street = addr.streetName ?? addr.street;
  const num = addr.streetNumber ?? addr.number;
  const line1 = [num, street].filter(Boolean).join(" ").trim();
  if (line1) return line1;
  return String(addr.deliveryLine ?? addr.streetAddress ?? "");
}

/**
 * Maps a single SimplyRETS /properties JSON object to our payload.
 */
export function mapSimplyRetsListing(raw: Record<string, unknown>): MlsListingPayload {
  const address = (raw.address as Record<string, unknown> | undefined) ?? {};
  const property = (raw.property as Record<string, unknown> | undefined) ?? {};
  const mls = (raw.mls as Record<string, unknown> | undefined) ?? {};

  const photos = normalizePhotos(raw.photos);

  const mlsIdRaw = mls.listingId ?? mls.listingNum ?? raw.mlsId ?? raw.listingId ?? raw.id;
  const mlsNumber =
    mlsIdRaw != null && String(mlsIdRaw).trim() !== ""
      ? String(mlsIdRaw)
      : String(raw.id ?? "");

  const id = mlsNumber || String(raw.id ?? "");

  const fullB = Number(property.bathsFull ?? 0);
  const halfB = Number(property.bathsHalf ?? 0);
  let baths = fullB + (halfB > 0 ? halfB * 0.5 : 0);
  if (!baths && property.bathsTotal != null) {
    baths = Number(property.bathsTotal);
  }
  if (!baths) {
    baths = Number(property.baths ?? raw.baths ?? 0);
  }

  const sqft = Number(
    property.area ?? property.livingArea ?? property.livingAreaSF ?? 0,
  );

  return {
    id,
    address: pickAddressLine(address),
    city: String(address.city ?? ""),
    price: Number(raw.listPrice ?? 0),
    beds: Number(property.bedrooms ?? property.beds ?? 0),
    baths: Number.isFinite(baths) ? baths : 0,
    sqft: Number.isFinite(sqft) ? sqft : 0,
    description: String(
      raw.publicRemarks ?? raw.remarks ?? raw.privateRemarks ?? "",
    ),
    photos,
    status: String(mls.status ?? raw.status ?? "Active"),
    daysOnMarket:
      mls.daysOnMarket != null ? Number(mls.daysOnMarket) : null,
    mlsNumber: mlsNumber || id,
  };
}
