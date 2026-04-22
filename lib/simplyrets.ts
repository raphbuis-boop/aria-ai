/**
 * SimplyRETS live MLS API — https://api.simplyrets.com/properties
 *
 * SimplyRETS uses HTTP Basic Auth. In their dashboard they call the two
 * credentials "API Key" (the username) and "API Secret" (the password).
 *
 * We accept several env var naming conventions so that agents can name
 * their Vercel env vars using whichever pattern matches their mental
 * model. Pairs are tried in priority order; the first one with both
 * halves populated wins.
 *
 *   1. SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_PASSWORD  (most explicit)
 *   2. SIMPLYRETS_USERNAME     + SIMPLYRETS_PASSWORD      (legacy explicit)
 *   3. SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_KEY       (agent named the
 *                                                          "secret" API_KEY)
 *   4. SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_SECRET
 *   5. SIMPLYRETS_API_KEY      + SIMPLYRETS_API_SECRET    (docs-spec pair)
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

type CredentialPair = {
  username: string;
  password: string;
  /** Human-readable source, e.g. "SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_KEY" */
  source: string;
};

const ENV_PAIRS: ReadonlyArray<[usernameVar: string, passwordVar: string]> = [
  ["SIMPLYRETS_API_USERNAME", "SIMPLYRETS_API_PASSWORD"],
  ["SIMPLYRETS_USERNAME", "SIMPLYRETS_PASSWORD"],
  ["SIMPLYRETS_API_USERNAME", "SIMPLYRETS_API_KEY"],
  ["SIMPLYRETS_API_USERNAME", "SIMPLYRETS_API_SECRET"],
  ["SIMPLYRETS_API_KEY", "SIMPLYRETS_API_SECRET"],
];

export function resolveSimplyRetsCredentials(): CredentialPair | null {
  for (const [uVar, pVar] of ENV_PAIRS) {
    const u = process.env[uVar]?.trim();
    const p = process.env[pVar]?.trim();
    if (u && p) return { username: u, password: p, source: `${uVar} + ${pVar}` };
  }
  return null;
}

export function isSimplyRetsConfigured(): boolean {
  return resolveSimplyRetsCredentials() !== null;
}

export function getSimplyRetsAuthHeader(): string {
  const creds = resolveSimplyRetsCredentials();
  if (!creds) {
    return `Basic ${Buffer.from(":").toString("base64")}`;
  }
  return `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
}

/**
 * Returns a sanitized summary of SimplyRETS-related env vars for log output.
 * Never returns full secrets — only a "first 4 chars + length" fingerprint.
 */
export function describeSimplyRetsEnv(): {
  apiUrl: string;
  detectedPair: string | null;
  vars: Record<string, { present: boolean; preview?: string; length?: number }>;
} {
  const fingerprints: Record<
    string,
    { present: boolean; preview?: string; length?: number }
  > = {};
  const known = [
    "SIMPLYRETS_API_URL",
    "SIMPLYRETS_API_USERNAME",
    "SIMPLYRETS_API_PASSWORD",
    "SIMPLYRETS_API_KEY",
    "SIMPLYRETS_API_SECRET",
    "SIMPLYRETS_USERNAME",
    "SIMPLYRETS_PASSWORD",
  ];
  for (const name of known) {
    const value = process.env[name]?.trim();
    if (value) {
      fingerprints[name] = {
        present: true,
        preview: value.slice(0, 4),
        length: value.length,
      };
    } else {
      fingerprints[name] = { present: false };
    }
  }
  const creds = resolveSimplyRetsCredentials();
  return {
    apiUrl:
      process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
      SIMPLYRETS_API_BASE,
    detectedPair: creds?.source ?? null,
    vars: fingerprints,
  };
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
export async function fetchMlsListingsForClient(opts: {
  city: string | null | undefined;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  limit?: number;
}): Promise<MlsListingPayload[]> {
  if (!isSimplyRetsConfigured()) return [];
  const { city, minPrice, maxPrice, minBeds, limit = 20 } = opts;
  if (!city?.trim()) return [];

  const base =
    process.env.SIMPLYRETS_API_URL?.replace(/\/$/, "") ?? SIMPLYRETS_API_BASE;
  const params = new URLSearchParams({
    state: "NJ",
    cities: city.trim(),
    status: "Active",
    limit: String(Math.min(100, limit)),
    ...(minPrice != null && minPrice > 0
      ? { minprice: String(minPrice) }
      : {}),
    ...(maxPrice != null && maxPrice > 0
      ? { maxprice: String(maxPrice) }
      : {}),
    ...(minBeds != null && minBeds > 0 ? { minbeds: String(minBeds) } : {}),
  });

  const res = await fetch(`${base}/properties?${params}`, {
    headers: {
      Authorization: getSimplyRetsAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  const rawListings = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).properties)
      ? (data as Record<string, unknown>).properties
      : [];
  return (rawListings as Record<string, unknown>[]).map((item) =>
    mapSimplyRetsListing(item),
  );
}

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
