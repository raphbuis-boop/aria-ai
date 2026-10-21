import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, THINKING_HEADROOM_TOKENS, getAnthropic } from "@/lib/ai";
import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";

/**
 * "Add from link or MLS #": turns a pasted Zillow / Realtor.com / NJMLS (or
 * Redfin, Trulia, Homes.com) listing URL into property fields, or takes a bare
 * MLS number as-is. Every value is a suggestion the agent confirms in a form
 * before anything is saved.
 *
 * Order of evidence for a URL: the page's structured data (JSON-LD, Open
 * Graph/meta tags) → Claude reading the page when that's incomplete → the
 * address in the URL itself (listing sites often block automated reads, but
 * the address is in the link).
 */

export type ExtractedProperty = {
  address: string | null;
  town: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photo: string | null;
  mlsNumber: string | null;
  sourceUrl: string | null;
};

export type ExtractResult = {
  kind: "url" | "mls";
  property: ExtractedProperty;
  /** Shown above the form, e.g. why some fields are empty. */
  note: string | null;
};

const EMPTY: ExtractedProperty = {
  address: null, town: null, state: null, zip: null, price: null, beds: null, baths: null,
  sqft: null, photo: null, mlsNumber: null, sourceUrl: null,
};

/** Listing sites we read. Anything else is refused (no fetching arbitrary URLs). */
const ALLOWED_DOMAINS = ["zillow.com", "realtor.com", "njmls.com", "redfin.com", "trulia.com", "homes.com"];

const SITE_NAMES: Record<string, string> = {
  "zillow.com": "Zillow", "realtor.com": "Realtor.com", "njmls.com": "NJMLS",
  "redfin.com": "Redfin", "trulia.com": "Trulia", "homes.com": "Homes.com",
};

function siteOf(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_DOMAINS.find((d) => h === d || h.endsWith(`.${d}`)) ?? null;
}

export type ClassifiedInput =
  | { kind: "url"; url: URL; site: string }
  | { kind: "mls"; mlsNumber: string }
  | { kind: "invalid"; reason: string };

export function classifyInput(raw: string): ClassifiedInput {
  const v = raw.trim();
  if (!v) return { kind: "invalid", reason: "Paste a listing link or an MLS number." };
  const mls = v.replace(/^(mls|listing)\s*(#|no\.?|number)?\s*:?\s*/i, "").trim();
  if (/^[A-Za-z]{0,3}\d{5,12}$/.test(mls)) return { kind: "mls", mlsNumber: mls.toUpperCase() };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return { kind: "invalid", reason: "That isn't a link or an MLS number." };
  }
  const site = siteOf(url.hostname);
  if (!site) {
    return { kind: "invalid", reason: "Paste a Zillow, Realtor.com or NJMLS link (or Redfin, Trulia, Homes.com)." };
  }
  url.protocol = "https:";
  return { kind: "url", url, site };
}

// ── The address in the URL ───────────────────────────────────────────────────

const TOWNS_BY_LENGTH = [...NJ_TOWN_OPTIONS].sort((a, b) => b.length - a.length);
const STREET_SUFFIX =
  /^(st|street|ave|avenue|rd|road|ln|lane|dr|drive|ct|court|pl|place|blvd|way|ter|terrace|cir|circle|pkwy|parkway|hwy|highway|sq|trl|trail|row|walk|run|xing|plz|loop|pike|tpke)$/i;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(\d+[a-z]+)\b/gi, (m) => m.toUpperCase()); // "2b" → "2B"
}

/**
 * "12-Sample-Ln-Glen-Rock-NJ-07452" (zip optional, anything after it ignored)
 * → street / town / state / zip.
 */
function splitAddressSlug(slug: string): Partial<ExtractedProperty> {
  const tokens = decodeURIComponent(slug).split(/[-_]+/).filter(Boolean);
  // The state: a 2-letter token that ends the address or is followed by a ZIP.
  let stateIdx = -1;
  tokens.forEach((t, i) => {
    if (/^[A-Za-z]{2}$/.test(t) && i >= 2 && (i === tokens.length - 1 || /^\d{5}$/.test(tokens[i + 1]))) stateIdx = i;
  });
  if (stateIdx < 2) return {};
  const state = tokens[stateIdx].toUpperCase();
  const zip = /^\d{5}$/.test(tokens[stateIdx + 1] ?? "") ? tokens[stateIdx + 1] : null;
  const before = tokens.slice(0, stateIdx);
  // Prefer a known NJ town at the end; otherwise split after the last street suffix.
  const joined = before.join(" ").toLowerCase();
  const town = TOWNS_BY_LENGTH.find((t) => joined.endsWith(` ${t.toLowerCase()}`));
  let streetTokens: string[];
  let townName: string | null;
  if (town) {
    const n = town.split(/\s+/).length;
    streetTokens = before.slice(0, before.length - n);
    townName = town;
  } else {
    let cut = -1;
    before.forEach((t, i) => {
      if (STREET_SUFFIX.test(t)) cut = i;
    });
    if (cut < 0 || cut === before.length - 1) return { state, zip };
    // Keep a unit ("Apt 2B") with the street.
    let end = cut + 1;
    if (/^(apt|unit|ste|#)$/i.test(before[end] ?? "") && before[end + 1]) end += 2;
    streetTokens = before.slice(0, end);
    townName = titleCase(before.slice(end).join(" "));
  }
  return {
    address: streetTokens.length ? titleCase(streetTokens.join(" ")) : null,
    town: townName,
    state,
    zip,
  };
}

/** What the listing URL itself says (address, MLS #). Pure. */
export function parseListingUrl(url: URL): Partial<ExtractedProperty> {
  const site = siteOf(url.hostname);
  const parts = url.pathname.split("/").filter(Boolean);
  const out: Partial<ExtractedProperty> = {};

  for (const key of ["mlsnum", "mls", "mlsnumber", "mls_number", "listingid", "listing_id"]) {
    const v = [...url.searchParams.entries()].find(([k]) => k.toLowerCase() === key)?.[1];
    if (v && /^[A-Za-z]{0,3}\d{5,12}$/.test(v.trim())) out.mlsNumber = v.trim().toUpperCase();
  }

  if (site === "zillow.com" || site === "trulia.com") {
    // /homedetails/12-Sample-Ln-Testville-NJ-07000/123_zpid/ · /home/12-sample-ln-testville-nj-07000-123
    const slug = parts.find((p, i) => i > 0 && /-[A-Za-z]{2}-\d{5}/.test(p));
    if (slug) Object.assign(out, splitAddressSlug(slug));
  } else if (site === "realtor.com") {
    // /realestateandhomes-detail/12-Sample-Ln_Testville_NJ_07000_M12345-67890
    const slug = parts.find((p) => /_[A-Za-z]{2}_\d{5}/.test(p));
    if (slug) {
      const [street, town, state, zip] = slug.split("_");
      Object.assign(out, {
        address: titleCase(street.replace(/-/g, " ")),
        town: titleCase(town.replace(/-/g, " ")),
        state: state.toUpperCase(),
        zip,
      });
    }
  } else if (site === "redfin.com") {
    // /NJ/Testville/12-Sample-Ln-07000/home/123
    if (parts.length >= 3 && /^[A-Za-z]{2}$/.test(parts[0])) {
      const m = parts[2].match(/^(.*)-(\d{5})$/);
      Object.assign(out, {
        state: parts[0].toUpperCase(),
        town: titleCase(decodeURIComponent(parts[1]).replace(/-/g, " ")),
        address: m ? titleCase(m[1].replace(/-/g, " ")) : null,
        zip: m?.[2] ?? null,
      });
    }
  } else if (site === "homes.com") {
    // /property/12-sample-ln-testville-nj/abc123/
    const slug = parts[0] === "property" ? parts[1] : null;
    if (slug) Object.assign(out, splitAddressSlug(slug));
  }
  return out;
}

// ── Structured data in the page ──────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,\s]/g, "").replace(/sq\.?\s*ft\.?/i, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  const m = tag?.match(/content="([^"]*)"|content='([^']*)'/i);
  const content = m?.[1] ?? m?.[2];
  return content ? decodeEntities(content).trim() || null : null;
}

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    yield o;
    for (const v of Object.values(o)) if (v && typeof v === "object") yield* walk(v);
  }
}

function imageOf(v: unknown): string | null {
  if (typeof v === "string") return /^https:\/\//.test(v) ? v : null;
  if (Array.isArray(v)) return v.map(imageOf).find(Boolean) ?? null;
  if (v && typeof v === "object") return imageOf((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl);
  return null;
}

/** JSON-LD (schema.org) and Open Graph/meta tags. Pure. */
export function extractFromHtml(html: string): Partial<ExtractedProperty> {
  const out: Partial<ExtractedProperty> = {};
  const set = <K extends keyof ExtractedProperty>(k: K, v: ExtractedProperty[K] | null | undefined) => {
    if (v != null && out[k] == null) out[k] = v;
  };

  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const o of walk(data)) {
      const addr = o.address as Record<string, unknown> | undefined;
      if (addr && typeof addr === "object" && typeof addr.streetAddress === "string") {
        set("address", decodeEntities(addr.streetAddress).trim());
        if (typeof addr.addressLocality === "string") set("town", addr.addressLocality.trim());
        if (typeof addr.addressRegion === "string") set("state", addr.addressRegion.trim().toUpperCase());
        if (typeof addr.postalCode === "string") set("zip", addr.postalCode.trim());
      }
      set("beds", num(o.numberOfBedrooms) ?? num(o.numberOfRooms));
      set("baths", num(o.numberOfBathroomsTotal) ?? num(o.numberOfFullBathrooms));
      const floor = o.floorSize as Record<string, unknown> | undefined;
      if (floor && typeof floor === "object") set("sqft", num(floor.value));
      const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
      if (offers && typeof offers === "object") set("price", num(offers.price));
      const types = ([] as unknown[]).concat(o["@type"] ?? []);
      if (types.includes("Offer") || types.includes("RealEstateListing")) set("price", num(o.price));
      set("photo", imageOf(o.image));
    }
  }

  const title = metaContent(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  const desc = metaContent(html, "og:description") ?? metaContent(html, "description");
  set("photo", imageOf(metaContent(html, "og:image") ?? metaContent(html, "twitter:image")));
  const text = decodeEntities([title, desc].filter(Boolean).join(" · "));
  if (text) {
    // "12 Sample Ln, Testville, NJ 07000"
    const a = text.match(/(\d+[^,|·]*?),\s*([A-Za-z .'-]+?),\s*([A-Z]{2})\s+(\d{5})/);
    if (a) {
      set("address", a[1].trim());
      set("town", a[2].trim());
      set("state", a[3]);
      set("zip", a[4]);
    }
    set("beds", num(text.match(/(\d+(?:\.\d+)?)\s*(?:bd|beds?|bedrooms?)\b/i)?.[1]));
    set("baths", num(text.match(/(\d+(?:\.\d+)?)\s*(?:ba|baths?|bathrooms?)\b/i)?.[1]));
    set("sqft", num(text.match(/([\d,]{3,7})\s*(?:sq\.?\s*ft|square\s*feet|sqft)/i)?.[1]));
    set("price", num(text.match(/\$\s?([\d,]{5,})/)?.[1]));
    set("mlsNumber", text.match(/MLS\s*(?:#|number|no\.?)?\s*:?\s*([A-Z]{0,3}\d{5,12})/i)?.[1]?.toUpperCase() ?? null);
  }
  return out;
}

// ── Fetching the page ────────────────────────────────────────────────────────

const MAX_HTML_BYTES = 4_000_000;

/**
 * GETs an allowed listing page. Redirects are followed by hand (max 3) and
 * only to allowed listing sites; https only; 8s timeout; size-capped.
 * Returns null when the site refuses (bot walls, 403/429) or anything fails.
 */
export async function fetchListingHtml(start: URL): Promise<{ html: string } | { blocked: true } | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:" || !siteOf(url.hostname)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url);
        continue;
      }
      if (res.status === 403 || res.status === 429) return { blocked: true };
      if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) return null;

      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        chunks.push(value);
        if (size > MAX_HTML_BYTES) {
          await reader.cancel();
          break;
        }
      }
      const html = new TextDecoder().decode(Buffer.concat(chunks));
      // Captcha / "press and hold" walls come back as 200s.
      if (/px-captcha|captcha-delivery|Press\s*&amp;?\s*Hold|are you a (?:robot|human)/i.test(html) && html.length < 200_000) {
        return { blocked: true };
      }
      return { html };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ── Claude, when the structured data is thin ─────────────────────────────────

/** Page text for the model: title, meta tags, JSON-LD and visible text, trimmed. */
function condensePage(html: string): string {
  const head = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    ...[...html.matchAll(/<meta[^>]+content=["'][^"']{3,}["'][^>]*>/gi)].slice(0, 40).map((m) => m[0]),
    ...[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].slice(0, 4000)),
  ]
    .filter(Boolean)
    .join("\n");
  const body = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).slice(0, 15_000);
  return `${head}\n\n${body}`.slice(0, 30_000);
}

const CLAUDE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    address: { type: ["string", "null"], description: "Street address only, e.g. '12 Sample Ln'" },
    town: { type: ["string", "null"] },
    state: { type: ["string", "null"] },
    zip: { type: ["string", "null"] },
    price: { type: ["number", "null"], description: "List or sale price in dollars" },
    beds: { type: ["number", "null"] },
    baths: { type: ["number", "null"] },
    sqft: { type: ["number", "null"] },
    photo: { type: ["string", "null"], description: "https URL of the main listing photo" },
    mlsNumber: { type: ["string", "null"] },
  },
  required: ["address", "town", "state", "zip", "price", "beds", "baths", "sqft", "photo", "mlsNumber"],
};

export async function extractWithClaude(html: string, url: string): Promise<Partial<ExtractedProperty> | null> {
  const client = getAnthropic();
  if (!client) return null;
  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 800 + THINKING_HEADROOM_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: CLAUDE_SCHEMA } },
      system:
        "You read a real-estate listing web page and pull out the listed home's facts. Use only values that appear on the page for this listing (not nearby or similar homes). Use null for anything not on the page — never guess.",
      messages: [{ role: "user", content: `Listing URL: ${url}\n\nPage:\n${condensePage(html)}` }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!block) return null;
    const p = JSON.parse(block.text) as Partial<ExtractedProperty>;
    return {
      ...p,
      photo: p.photo && /^https:\/\//.test(p.photo) ? p.photo : null,
      price: num(p.price),
      beds: num(p.beds),
      baths: num(p.baths),
      sqft: num(p.sqft),
    };
  } catch (err) {
    console.error("[property-extract] Claude failed", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return null;
  }
}

function merge(...layers: Partial<ExtractedProperty>[]): ExtractedProperty {
  const out: ExtractedProperty = { ...EMPTY };
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer) as [keyof ExtractedProperty, ExtractedProperty[keyof ExtractedProperty]][]) {
      if (v != null && v !== "" && out[k] == null) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

const CORE: (keyof ExtractedProperty)[] = ["address", "town", "price", "beds", "baths"];

export async function extractProperty(input: string): Promise<ExtractResult | { error: string }> {
  const c = classifyInput(input);
  if (c.kind === "invalid") return { error: c.reason };
  if (c.kind === "mls") {
    return {
      kind: "mls",
      property: { ...EMPTY, mlsNumber: c.mlsNumber },
      note: "Saved with MLS # only — fill in the rest from the listing.",
    };
  }

  const site = SITE_NAMES[c.site] ?? c.site;
  const fromUrl = parseListingUrl(c.url);
  const page = await fetchListingHtml(c.url);
  const sourceUrl = c.url.toString();

  if (!page || "blocked" in page) {
    const property = merge({ sourceUrl }, fromUrl);
    return {
      kind: "url",
      property,
      note: `${site} didn't let Aria read the page${property.address ? ", so only the address from the link is filled in" : ""}. Add the price, beds and baths from the listing.`,
    };
  }

  const structured = extractFromHtml(page.html);
  let fromClaude: Partial<ExtractedProperty> | null = null;
  if (CORE.some((k) => structured[k] == null)) fromClaude = await extractWithClaude(page.html, sourceUrl);

  const property = merge({ sourceUrl }, structured, fromClaude ?? {}, fromUrl);
  const missing = CORE.filter((k) => property[k] == null);
  return {
    kind: "url",
    property,
    note: missing.length
      ? `Filled in from ${site}. Couldn't find: ${missing.join(", ")} — add them before saving.`
      : `Filled in from ${site} — check the details before saving.`,
  };
}
