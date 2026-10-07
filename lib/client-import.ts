import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPhoneE164 } from "@/lib/utils";

/**
 * One import path for every source (CSV, Google Contacts): normalize phone
 * and email, drop rows with nothing usable, skip people the agent already
 * has (or that appear twice in the same file), and report each decision by
 * row so the agent can see exactly what happened. Nothing is invented — no
 * lead scores, no guessed fields.
 */

export const MAX_IMPORT_ROWS = 2000;
const INSERT_CHUNK = 500;

/** "leads" = people actively buying/selling; "sphere" = past clients, friends, contacts. */
export type ImportGroup = "leads" | "sphere";

export type IncomingContact = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  client_role?: unknown;
  budget_min?: unknown;
  budget_max?: unknown;
  town?: unknown;
  notes?: unknown;
  source?: unknown;
};

export type ImportNote = { row: number; name: string; reason: string };

export type ImportResult = {
  inserted: number;
  skipped: ImportNote[]; // not imported (duplicate / unusable)
  warnings: ImportNote[]; // imported, but a field was dropped
  insertedIds: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase().replace(/^mailto:/, "") : "";
  return EMAIL_RE.test(v) ? v : null;
}

/** Collapses whitespace and strips stray quotes: '  "Dana   Reyes" ' → 'Dana Reyes'. */
export function normalizeName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, " ").trim() : "";
}

function str(raw: unknown, max = 500): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const v = String(raw).trim();
  return v ? v.slice(0, max) : null;
}

function money(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1);
  return n > 0 ? Math.round(n) : null;
}

export async function importClients(
  supabase: SupabaseClient,
  agentId: string,
  rows: IncomingContact[],
  opts: { group: ImportGroup; defaultSource: string },
): Promise<ImportResult> {
  const { data: existing, error: loadError } = await supabase
    .from("clients")
    .select("name, email, phone")
    .eq("agent_id", agentId);
  if (loadError) throw new Error(loadError.message);

  // Existing rows may hold phones in older formats — normalize before comparing.
  const seenEmail = new Map<string, string>();
  const seenPhone = new Map<string, string>();
  const seenNameOnly = new Set<string>();
  for (const c of existing ?? []) {
    const name = String(c.name ?? "");
    const e = normalizeEmail(c.email);
    const p = c.phone ? formatPhoneE164(String(c.phone)) : null;
    if (e) seenEmail.set(e, name);
    if (p) seenPhone.set(p, name);
    if (!e && !p) seenNameOnly.add(name.toLowerCase());
  }

  const skipped: ImportNote[] = [];
  const warnings: ImportNote[] = [];
  const toInsert: Record<string, unknown>[] = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    const email = normalizeEmail(row.email);
    const rawPhone = str(row.phone, 40);
    const phone = rawPhone ? formatPhoneE164(rawPhone) : null;
    const name = normalizeName(row.name) || (email ?? "");

    if (!name) {
      skipped.push({ row: n, name: "", reason: "No name, email or phone" });
      return;
    }
    if (!email && !phone && !str(row.notes)) {
      // A bare name can't be contacted and can't be de-duplicated reliably.
      if (seenNameOnly.has(name.toLowerCase())) {
        skipped.push({ row: n, name, reason: "Already in your clients" });
        return;
      }
    }
    const dupOf = (email ? seenEmail.get(email) : undefined) ?? (phone ? seenPhone.get(phone) : undefined);
    if (dupOf !== undefined) {
      skipped.push({ row: n, name, reason: `Already in your clients${dupOf && dupOf !== name ? ` as ${dupOf}` : ""}` });
      return;
    }

    if (rawPhone && !phone) warnings.push({ row: n, name, reason: `Phone "${rawPhone}" isn't a full number — left blank` });
    const rawEmail = str(row.email, 200);
    if (rawEmail && !email) warnings.push({ row: n, name, reason: `Email "${rawEmail}" isn't valid — left blank` });

    const town = str(row.town, 80);
    toInsert.push({
      agent_id: agentId,
      name: name.slice(0, 120),
      email,
      phone,
      client_role: String(row.client_role ?? "").toLowerCase() === "seller" ? "seller" : "buyer",
      budget_min: money(row.budget_min),
      budget_max: money(row.budget_max),
      town,
      preferred_towns: town ? [town] : null,
      notes: str(row.notes, 2000),
      source: str(row.source, 40) ?? opts.defaultSource,
      // Known people from her sphere aren't "new leads".
      status: opts.group === "sphere" ? "contacted" : "new",
    });
    if (email) seenEmail.set(email, name);
    if (phone) seenPhone.set(phone, name);
    if (!email && !phone) seenNameOnly.add(name.toLowerCase());
  });

  const insertedIds: string[] = [];
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const { data, error } = await supabase.from("clients").insert(toInsert.slice(i, i + INSERT_CHUNK)).select("id");
    if (error) {
      // Report the failed chunk instead of failing the rows that already went in.
      for (let j = i; j < Math.min(i + INSERT_CHUNK, toInsert.length); j++) {
        skipped.push({ row: j + 1, name: String(toInsert[j].name), reason: `Couldn't save: ${error.message}` });
      }
      continue;
    }
    for (const r of data ?? []) insertedIds.push(String(r.id));
  }

  return { inserted: insertedIds.length, skipped, warnings, insertedIds };
}
