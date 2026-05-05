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

/** Browser-openable API URL for a single listing (may 401 without Basic auth). */
export function getSimplyRetsListingApiUrl(mlsId: string): string {
  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
    SIMPLYRETS_API_BASE;
  return `${base}/properties/${encodeURIComponent(mlsId)}`;
}

/** Map UI sort keys to SimplyRETS `sort` query values. */
export const MLS_SORT_PARAM: Record<string, string> = {
  newest: "-listdate",
  price_asc: "listprice",
  price_desc: "-listprice",
  beds_desc: "-bedrooms",
};

export type MlsListingPayload = {
  id: string;
  address: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  photos: string[];
  status: string;
  daysOnMarket: number | null;
  mlsNumber: string;
  // Extended fields (all optional) used by the detail view and filters.
  lotSize?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
  propertySubType?: string | null;
  stories?: number | null;
  garageSpaces?: number | null;
  listDate?: string | null;
  lat?: number | null;
  lng?: number | null;
  taxAnnualAmount?: number | null;
  taxYear?: number | null;
  hoaFee?: number | null;
  hoaFrequency?: string | null;
  listingRepresentative?: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  listingFirm?: { name: string | null; phone: string | null } | null;
  openHouses?: Array<{
    startTime: string | null;
    endTime: string | null;
    appointmentOnly?: boolean;
  }>;
  schools?: { district: string | null; elementary: string | null; middle: string | null; high: string | null } | null;
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  heating?: string | null;
  cooling?: string | null;
  parking?: string | null;
  subdivision?: string | null;
  /** Absolute URL on SimplyRETS (or agency site) for the raw listing, if known. */
  externalUrl?: string | null;
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
  /** When set, passed as SimplyRETS `state`. Omit for all states in the feed. */
  state?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  limit?: number;
}): Promise<MlsListingPayload[]> {
  if (!isSimplyRetsConfigured()) return [];
  const { city, state, minPrice, maxPrice, minBeds, limit = 20 } = opts;
  if (!city?.trim()) return [];

  const base =
    process.env.SIMPLYRETS_API_URL?.replace(/\/$/, "") ?? SIMPLYRETS_API_BASE;
  const params = new URLSearchParams({
    cities: city.trim(),
    status: "Active",
    limit: String(Math.min(100, limit)),
    ...(state?.trim() ? { state: state.trim() } : {}),
    ...(minPrice != null && minPrice > 0
      ? { minprice: String(minPrice) }
      : {}),
    ...(maxPrice != null && maxPrice > 0
      ? { maxprice: String(maxPrice) }
      : {}),
    ...(minBeds != null && minBeds > 0 ? { minbeds: String(minBeds) } : {}),
  });

  console.log("[simplyrets] fetchMlsListingsForClient params", {
    ...Object.fromEntries(params.entries()),
    base,
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapSimplyRetsListing(raw: Record<string, unknown>): MlsListingPayload {
  const address = (raw.address as Record<string, unknown> | undefined) ?? {};
  const property = (raw.property as Record<string, unknown> | undefined) ?? {};
  const mls = (raw.mls as Record<string, unknown> | undefined) ?? {};
  const geo = (raw.geo as Record<string, unknown> | undefined) ?? {};
  const tax = (raw.tax as Record<string, unknown> | undefined) ?? {};
  const sellerContactRecord =
    (raw["agent"] as Record<string, unknown> | undefined) ?? {};
  const firmRecord =
    (raw["office"] as Record<string, unknown> | undefined) ?? {};
  const association =
    (raw.association as Record<string, unknown> | undefined) ?? {};
  const school = (raw.school as Record<string, unknown> | undefined) ?? {};

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

  const openHouses = Array.isArray(raw.openHouses)
    ? (raw.openHouses as Record<string, unknown>[]).map((o) => ({
        startTime:
          typeof o.startTime === "string"
            ? o.startTime
            : typeof o.start === "string"
              ? o.start
              : null,
        endTime:
          typeof o.endTime === "string"
            ? o.endTime
            : typeof o.end === "string"
              ? o.end
              : null,
        appointmentOnly: Boolean(o.appointmentOnly),
      }))
    : [];

  const participantName =
    [sellerContactRecord.firstName, sellerContactRecord.lastName]
      .filter((s) => typeof s === "string" && String(s).trim())
      .join(" ")
      .trim() ||
    (typeof sellerContactRecord.name === "string"
      ? sellerContactRecord.name
      : "");

  return {
    id,
    address: pickAddressLine(address),
    city: String(address.city ?? ""),
    state: typeof address.state === "string" ? address.state : null,
    postalCode:
      typeof address.postalCode === "string"
        ? address.postalCode
        : typeof address.zip === "string"
          ? (address.zip as string)
          : null,
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
    lotSize: numOrNull(property.lotSize ?? property.lotSizeArea),
    yearBuilt: numOrNull(property.yearBuilt),
    propertyType:
      typeof property.type === "string"
        ? property.type
        : typeof raw.propertyType === "string"
          ? (raw.propertyType as string)
          : null,
    propertySubType:
      typeof property.subType === "string" ? property.subType : null,
    stories: numOrNull(property.stories),
    garageSpaces: numOrNull(property.garageSpaces),
    listDate:
      typeof raw.listDate === "string" ? (raw.listDate as string) : null,
    lat: numOrNull(geo.lat ?? geo.latitude),
    lng: numOrNull(geo.lng ?? geo.longitude),
    taxAnnualAmount: numOrNull(tax.taxAnnualAmount),
    taxYear: numOrNull(tax.taxYear),
    hoaFee: numOrNull(association.fee),
    hoaFrequency:
      typeof association.feeFrequency === "string"
        ? association.feeFrequency
        : null,
    listingRepresentative: participantName
      ? {
          name: participantName || null,
          email:
            typeof sellerContactRecord.contact === "object" &&
            sellerContactRecord.contact
              ? (() => {
                  const c = sellerContactRecord.contact as Record<
                    string,
                    unknown
                  >;
                  return typeof c.email === "string" ? c.email : null;
                })()
              : typeof sellerContactRecord.email === "string"
                ? (sellerContactRecord.email as string)
                : null,
          phone:
            typeof sellerContactRecord.contact === "object" &&
            sellerContactRecord.contact
              ? (() => {
                  const c = sellerContactRecord.contact as Record<
                    string,
                    unknown
                  >;
                  return typeof c.cell === "string"
                    ? (c.cell as string)
                    : typeof c["office"] === "string"
                      ? (c["office"] as string)
                      : null;
                })()
              : typeof sellerContactRecord.phone === "string"
                ? (sellerContactRecord.phone as string)
                : null,
        }
      : null,
    listingFirm: firmRecord.name
      ? {
          name: typeof firmRecord.name === "string" ? firmRecord.name : null,
          phone:
            typeof firmRecord.contact === "object" && firmRecord.contact
              ? (() => {
                  const c = firmRecord.contact as Record<string, unknown>;
                  return typeof c["office"] === "string"
                    ? (c["office"] as string)
                    : null;
                })()
              : typeof firmRecord.phone === "string"
                ? (firmRecord.phone as string)
                : null,
        }
      : null,
    openHouses: openHouses.length ? openHouses : undefined,
    schools: school
      ? {
          district:
            typeof school.district === "string" ? school.district : null,
          elementary:
            typeof school.elementarySchool === "string"
              ? school.elementarySchool
              : null,
          middle:
            typeof school.middleSchool === "string"
              ? school.middleSchool
              : null,
          high:
            typeof school.highSchool === "string" ? school.highSchool : null,
        }
      : null,
    interiorFeatures: asStringArray(property.interiorFeatures),
    exteriorFeatures: asStringArray(property.exteriorFeatures),
    heating: typeof property.heating === "string" ? property.heating : null,
    cooling: typeof property.cooling === "string" ? property.cooling : null,
    parking: typeof property.parking === "string" ? property.parking : null,
    subdivision:
      typeof property.subdivision === "string" ? property.subdivision : null,
    externalUrl:
      typeof raw.virtualTourUrl === "string"
        ? (raw.virtualTourUrl as string)
        : typeof raw.url === "string"
          ? (raw.url as string)
          : typeof raw.listingUrl === "string"
            ? (raw.listingUrl as string)
            : null,
  };
}

export type SimplyRetsSinglePropertyFailure =
  | { kind: "not_configured" }
  | { kind: "network"; endpoint: string; message: string }
  | {
      kind: "upstream";
      status: number;
      endpoint: string;
      bodyPreview: string;
    };

export type SimplyRetsSinglePropertyResult =
  | { ok: true; listing: MlsListingPayload; raw: Record<string, unknown> }
  | { ok: false; failure: SimplyRetsSinglePropertyFailure };

/**
 * Server-only: fetches one listing from SimplyRETS with Basic auth.
 * Never call from the browser — credentials stay on the server.
 */
export async function fetchSimplyRetsSingleProperty(
  mlsId: string,
): Promise<SimplyRetsSinglePropertyResult> {
  const trimmed = mlsId?.trim();
  if (!trimmed) {
    return {
      ok: false,
      failure: {
        kind: "upstream",
        status: 400,
        endpoint: "",
        bodyPreview: "mlsId required",
      },
    };
  }

  if (!isSimplyRetsConfigured()) {
    return { ok: false, failure: { kind: "not_configured" } };
  }

  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
    SIMPLYRETS_API_BASE;
  const endpoint = `${base}/properties/${encodeURIComponent(trimmed)}`;

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
    return {
      ok: false,
      failure: { kind: "network", endpoint, message },
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      failure: {
        kind: "upstream",
        status: 404,
        endpoint,
        bodyPreview: "",
      },
    };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      failure: {
        kind: "upstream",
        status: response.status,
        endpoint,
        bodyPreview: text.slice(0, 500),
      },
    };
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return {
    ok: true,
    listing: mapSimplyRetsListing(raw),
    raw,
  };
}
