import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { callClaude, safeJsonParse } from "@/lib/ai";

export type CsvMappingItem = {
  header: string;
  field: string;
  confidence: "high" | "low";
};

const SYSTEM = `You are a data field mapper for a real estate CRM called Aria.
Map CSV column headers to Aria client fields.

Aria fields:
- name         (full name — use if first+last are combined)
- first_name   (given name only)
- last_name    (family name only)
- email        (email address)
- phone        (any phone number format)
- client_role  (buyer or seller)
- budget       (single budget number, e.g. $500k)
- budget_min   (lower end of budget range)
- budget_max   (upper end of budget range)
- town         (preferred town, area, or city)
- notes        (free-form notes or comments)
- source       (lead source, referral type)
- skip         (column has no useful mapping — use this liberally)

Return ONLY a valid JSON array, no other text or markdown. Each element:
{ "header": "<original header>", "field": "<aria field>", "confidence": "high" | "low" }

Rules:
- Use "high" confidence when the match is obvious (e.g. "Email" → email, "Cell" → phone).
- Use "low" confidence when you are guessing.
- Prefer "skip" over a wrong mapping. When in doubt, skip.
- Never invent field names outside the list above.`;

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const headers: string[] = Array.isArray(body.headers)
    ? (body.headers as unknown[]).slice(0, 30).map(String)
    : [];

  if (!headers.length)
    return NextResponse.json({ error: "headers required" }, { status: 400 });

  const raw = await callClaude(SYSTEM, `Map these CSV headers: ${JSON.stringify(headers)}`, 300);
  const parsed = safeJsonParse<CsvMappingItem[]>(raw);

  if (!parsed || !Array.isArray(parsed)) {
    const fallback: CsvMappingItem[] = headers.map((h) => ({
      header: h,
      field: "skip",
      confidence: "low",
    }));
    return NextResponse.json({ mapping: fallback });
  }

  // Ensure every header has an entry
  const mappedHeaders = new Set(parsed.map((m) => m.header));
  for (const h of headers) {
    if (!mappedHeaders.has(h)) {
      parsed.push({ header: h, field: "skip", confidence: "low" });
    }
  }

  return NextResponse.json({ mapping: parsed });
}
