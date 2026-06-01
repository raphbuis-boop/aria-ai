import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { formatPhoneE164 } from "@/lib/utils";

const MAX_ROWS = 500;

type ImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  client_role: "buyer" | "seller";
  budget_min: number | null;
  budget_max: number | null;
  town: string | null;
  notes: string | null;
  source: string | null;
};

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawRows: unknown[] = Array.isArray(body.rows)
    ? body.rows.slice(0, MAX_ROWS)
    : [];

  if (!rawRows.length)
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });

  // Fetch existing client emails + phones for this agent (dedup)
  const { data: existing } = await supabase
    .from("clients")
    .select("email, phone")
    .eq("agent_id", user.id);

  const existingEmails = new Set<string>(
    (existing ?? [])
      .filter((c) => c.email)
      .map((c) => String(c.email).toLowerCase().trim()),
  );
  const existingPhoneDigits = new Set<string>(
    (existing ?? [])
      .filter((c) => c.phone)
      .map((c) => String(c.phone).replace(/\D/g, "")),
  );

  const toInsert: Record<string, unknown>[] = [];
  const errors: { row: number; reason: string }[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i] as ImportRow;

    const name = String(row.name ?? "").trim();
    if (!name) {
      errors.push({ row: i + 1, reason: "Missing name — row skipped" });
      continue;
    }

    const email = row.email ? String(row.email).toLowerCase().trim() : null;
    const rawPhone = row.phone ? String(row.phone).trim() : null;
    const phone = rawPhone ? formatPhoneE164(rawPhone) : null;

    // Dedup by email
    if (email && existingEmails.has(email)) {
      skipped++;
      continue;
    }
    // Dedup by phone digits
    const phoneDigits = phone ? phone.replace(/\D/g, "") : null;
    if (phoneDigits && existingPhoneDigits.has(phoneDigits)) {
      skipped++;
      continue;
    }

    const clientRole: "buyer" | "seller" =
      String(row.client_role ?? "").toLowerCase() === "seller" ? "seller" : "buyer";

    toInsert.push({
      agent_id: user.id,
      name,
      email: email || null,
      phone: phone || null,
      client_role: clientRole,
      budget_min: row.budget_min ?? null,
      budget_max: row.budget_max ?? null,
      town: row.town?.trim() || null,
      notes: row.notes?.trim() || null,
      source: row.source?.trim() || "csv_import",
      status: "new",
      lead_score: 5,
    });

    // Track within-batch dedup
    if (email) existingEmails.add(email);
    if (phoneDigits) existingPhoneDigits.add(phoneDigits);
  }

  if (!toInsert.length) {
    return NextResponse.json({ inserted: 0, skipped, errors });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(toInsert)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: data?.length ?? toInsert.length,
    skipped,
    errors,
  });
}
