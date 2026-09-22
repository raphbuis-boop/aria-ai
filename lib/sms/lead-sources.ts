/**
 * Maps inbound lead payloads from each source onto the fields `ingestLead`
 * needs. Pure functions — no I/O — so each provider's shape is easy to test
 * against a real sample payload once the provider connection is live.
 *
 * Provider field names vary by integration partner and account setup, so
 * readers accept the common aliases rather than one exact schema.
 */

export const LEAD_SOURCES = [
  "website", "zillow", "realtor", "meta", "google", "referral", "manual", "sms", "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

const SOURCE_ALIASES: Record<string, LeadSource> = {
  facebook: "meta",
  instagram: "meta",
  meta_ads: "meta",
  "realtor.com": "realtor",
  realtorcom: "realtor",
  idx: "website",
  web: "website",
  form: "website",
  text: "sms",
};

export function normalizeLeadSource(raw: unknown): LeadSource {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if ((LEAD_SOURCES as readonly string[]).includes(value)) return value as LeadSource;
  return SOURCE_ALIASES[value] ?? "other";
}

/** clients.source has a fixed check constraint; map onto its vocabulary.
 * The precise origin is kept in clients.lead_source. */
export function clientSourceFor(source: LeadSource): string {
  switch (source) {
    case "zillow":
    case "google":
    case "referral":
    case "manual":
      return source;
    case "meta":
      return "facebook";
    default:
      return "other";
  }
}

export type ParsedLead = {
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  town: string | null;
  budgetMax: number | null;
  propertyAddress: string | null;
  /** Provider's id for this lead event — used to ignore redeliveries. */
  providerEventId: string | null;
};

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
}

function str(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function num(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v);
    if (typeof v === "string" && v.trim()) {
      const m = v.replace(/[$,\s]/g, "").toLowerCase().match(/^(\d+(?:\.\d+)?)(k|m|mm)?$/);
      if (!m) continue;
      const scale = m[2] === "k" ? 1_000 : m[2] ? 1_000_000 : 1;
      const n = Number(m[1]) * scale;
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}

function fullName(r: Rec): string | null {
  const joined = [str(r.firstName, r.first_name, r.FirstName), str(r.lastName, r.last_name, r.LastName)]
    .filter(Boolean)
    .join(" ");
  return str(r.name, r.fullName, r.full_name, r.Name, r.FullName) ?? (joined || null);
}

function address(r: Rec): string | null {
  const direct = str(r.propertyAddress, r.listingAddress, r.listing_address, r.address, r.streetAddress, r.street);
  if (!direct) return null;
  const city = str(r.city, r.City);
  return city && !direct.toLowerCase().includes(city.toLowerCase()) ? `${direct}, ${city}` : direct;
}

/** Flat JSON: website forms, manual entry, referrals, and any partner that
 * posts a simple object. */
function parseFlat(r: Rec): ParsedLead {
  return {
    name: fullName(r) ?? "",
    phone: str(r.phone, r.phoneNumber, r.phone_number, r.mobile, r.cell, r.Phone) ?? "",
    email: str(r.email, r.emailAddress, r.Email),
    message: str(r.message, r.comments, r.comment, r.note, r.notes, r.Message),
    town: str(r.town, r.preferredLocation, r.preferred_location, r.city, r.City),
    budgetMax: num(r.budgetMax, r.budget_max, r.maxPrice, r.max_price, r.budget),
    propertyAddress: address(r),
    providerEventId: str(r.eventId, r.event_id, r.leadId, r.lead_id, r.id),
  };
}

/** Zillow lead deliveries nest the contact under consumer/contact and the
 * home under property/listing. */
function parseZillow(r: Rec): ParsedLead {
  const contact = { ...rec(r.consumer), ...rec(r.contact), ...rec(r.Contact) };
  const home = { ...rec(r.property), ...rec(r.listing), ...rec(r.Listing) };
  const flat = parseFlat({ ...r, ...contact });
  return {
    ...flat,
    propertyAddress: address(home) ?? flat.propertyAddress,
    town: str(home.city, home.City) ?? flat.town,
    budgetMax: num(home.price, home.listPrice, r.price) ?? flat.budgetMax,
    providerEventId: str(r.zillowLeadId, r.leadId, r.LeadId, r.eventId, r.id),
  };
}

/** Realtor.com lead deliveries (via its lead-delivery partners) use a lead
 * object with contact + listing blocks. */
function parseRealtor(r: Rec): ParsedLead {
  const lead = { ...r, ...rec(r.lead), ...rec(r.Lead) };
  const contact = { ...rec(lead.contact), ...rec(lead.consumer), ...rec(lead.Contact) };
  const home = { ...rec(lead.listing), ...rec(lead.property), ...rec(lead.Listing) };
  const flat = parseFlat({ ...lead, ...contact });
  return {
    ...flat,
    propertyAddress: address(home) ?? flat.propertyAddress,
    town: str(home.city, home.City) ?? flat.town,
    budgetMax: num(home.price, home.listPrice) ?? flat.budgetMax,
    providerEventId: str(lead.leadGuid, lead.realtorLeadId, lead.leadId, lead.id),
  };
}

/** Meta Lead Ads: `field_data` from the Graph API lead object
 * (GET /{leadgen_id}?fields=field_data), not the webhook body. */
export function parseMetaLead(lead: { id?: string; field_data?: Array<{ name?: string; values?: string[] }> }): ParsedLead {
  const fields: Rec = {};
  for (const f of lead.field_data ?? []) {
    if (f.name) fields[f.name.toLowerCase()] = f.values?.[0];
  }
  const flat = parseFlat(fields);
  return { ...flat, providerEventId: lead.id ?? null };
}

export function parseLeadPayload(source: LeadSource, payload: unknown): ParsedLead {
  const r = rec(payload);
  if (source === "zillow") return parseZillow(r);
  if (source === "realtor") return parseRealtor(r);
  return parseFlat(r);
}
