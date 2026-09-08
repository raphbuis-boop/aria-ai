import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { NJ_TOWN_OPTIONS, normalizeTown } from "@/lib/nj-towns";

// Public — the client-facing /property-search portal also uses this, and it
// carries no sensitive data (NL text in, structured filters out).
export const dynamic = "force-dynamic";

const PROPERTY_TYPES = ["Residential", "Condo", "Multi-Family", "Townhouse", "Land"] as const;
const KNOWN_TOWNS = new Set<string>(NJ_TOWN_OPTIONS);

export type ParsedSearchFilters = {
  towns: string[];
  beds: number | null;
  baths: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  propertyType: (typeof PROPERTY_TYPES)[number] | null;
  keywords: string[];
};

const EMPTY_FILTERS: ParsedSearchFilters = {
  towns: [],
  beds: null,
  baths: null,
  minPrice: null,
  maxPrice: null,
  propertyType: null,
  keywords: [],
};

function isFiltersEmpty(f: ParsedSearchFilters): boolean {
  return (
    f.towns.length === 0 &&
    f.beds === null &&
    f.baths === null &&
    f.minPrice === null &&
    f.maxPrice === null &&
    f.propertyType === null &&
    f.keywords.length === 0
  );
}

function clampNumber(n: unknown, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, Math.round(v)));
}

const SYSTEM_PROMPT = `You convert a home buyer's plain-English description into structured MLS search filters for New Jersey real estate.
Return ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{"towns": string[], "beds": number|null, "baths": number|null, "minPrice": number|null, "maxPrice": number|null, "propertyType": "Residential"|"Condo"|"Multi-Family"|"Townhouse"|"Land"|null, "keywords": string[]}
Rules:
- towns: New Jersey town/city names mentioned, spelled properly. Empty array if none mentioned.
- beds/baths: the MINIMUM the buyer wants, as a plain number. Null if not mentioned.
- minPrice/maxPrice: dollar amounts as plain numbers, no symbols (e.g. "under $1M" -> maxPrice 1000000; "1.2M-1.5M" -> minPrice 1200000, maxPrice 1500000). Null if not mentioned.
- propertyType: only set if clearly implied ("condo" -> Condo, "multi-family"/"duplex" -> Multi-Family, "land"/"lot" -> Land, "townhouse"/"townhome" -> Townhouse, "house"/"single family" -> Residential). Null otherwise.
- keywords: notable features/qualifiers not captured above (e.g. "pool", "ADU", "fixer", "waterfront", "garage", "renovated"). Short lowercase phrases, max 6.
- If the text is gibberish, empty, or unrelated to real estate, return every field null/empty.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? "").trim().slice(0, 300);

  if (!query) {
    return NextResponse.json({ filters: EMPTY_FILTERS, keywordFallback: "" });
  }

  // No model configured, or the model call itself fails — never block the
  // search. Treat the raw text as a plain keyword/town search instead.
  if (!getAnthropic()) {
    return NextResponse.json({ filters: EMPTY_FILTERS, keywordFallback: query });
  }

  try {
    const raw = await callClaude(SYSTEM_PROMPT, `Buyer description: "${query}"`, 300);
    const parsed = safeJsonParse<Record<string, unknown>>(raw);
    if (!parsed) {
      return NextResponse.json({ filters: EMPTY_FILTERS, keywordFallback: query });
    }

    const towns = Array.isArray(parsed.towns)
      ? Array.from(
          new Set(
            parsed.towns
              .filter((t): t is string => typeof t === "string")
              .map((t) => normalizeTown(t))
              .filter((t) => t && KNOWN_TOWNS.has(t)),
          ),
        ).slice(0, 5)
      : [];

    const propertyType =
      typeof parsed.propertyType === "string" &&
      (PROPERTY_TYPES as readonly string[]).includes(parsed.propertyType)
        ? (parsed.propertyType as ParsedSearchFilters["propertyType"])
        : null;

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
          .map((k) => k.trim().toLowerCase())
          .slice(0, 6)
      : [];

    let minPrice = clampNumber(parsed.minPrice, 0, 100_000_000);
    let maxPrice = clampNumber(parsed.maxPrice, 0, 100_000_000);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }

    const filters: ParsedSearchFilters = {
      towns,
      beds: clampNumber(parsed.beds, 0, 10),
      baths: clampNumber(parsed.baths, 0, 10),
      minPrice,
      maxPrice,
      propertyType,
      keywords,
    };

    // Nothing usable came back (gibberish, unrelated text) — fall back to a
    // plain keyword search on the original text rather than an empty result.
    return NextResponse.json({
      filters,
      keywordFallback: isFiltersEmpty(filters) ? query : "",
    });
  } catch {
    return NextResponse.json({ filters: EMPTY_FILTERS, keywordFallback: query });
  }
}
