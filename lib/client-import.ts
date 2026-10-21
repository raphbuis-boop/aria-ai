import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactGroup, ImportSource, ParsedContact } from "@/lib/contacts/types";
import { planImport, type ExistingClient } from "@/lib/contacts/plan";
import { birthdayForDb } from "@/lib/contacts/normalize";

/**
 * The one bulk intake path for every import source (Google Contacts, CSV /
 * XLSX / vCard files, pasted lists, the iPhone address book). Each contact is
 * normalized and de-duplicated against the agent's clients on ANY email or
 * phone (lib/contacts/plan.ts — the same planner the import screen previews
 * with). New clients are tagged lead_source = `import_<source>` and the group
 * the agent picked. Imports are never texted, never notified one by one, and
 * never get drip drafts (see isBulkImported / api/automation/run).
 */

export const MAX_IMPORT_ROWS = 2000;
const INSERT_CHUNK = 500;
const PAGE = 1000;

export type ImportNote = { row: number; name: string; reason: string };

export type ImportOutcome = {
  inserted: number;
  existing: number;
  noContact: number;
  duplicates: number;
  /** Not imported: already a client, or no phone/email. */
  skipped: ImportNote[];
  /** Imported, but a value was dropped (an unreadable phone or email). */
  warnings: ImportNote[];
  insertedIds: string[];
};

/** clients.source values the importer wrote before lead_source carried `import_*`. */
const LEGACY_IMPORT_SOURCES = new Set(["csv_import", "sphere", "google_contacts", "past_client"]);

/** True for anyone who came in through a bulk import (old or new). */
export function isBulkImported(c: { source?: string | null; lead_source?: string | null }): boolean {
  return (c.lead_source ?? "").startsWith("import_") || LEGACY_IMPORT_SOURCES.has(c.source ?? "");
}

/**
 * clients.source keeps its constrained vocabulary (zillow/google/facebook/
 * referral/other/manual); the precise origin lives in lead_source.
 */
function clientSourceFor(source: ImportSource): string {
  return source === "google" ? "google" : "other";
}

/** Every client's contact points, all pages (PostgREST returns at most 1,000 rows per request). */
export async function loadExistingContacts(supabase: SupabaseClient, agentId: string): Promise<ExistingClient[]> {
  const out: ExistingClient[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone, emails, phones")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as ExistingClient[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function importContacts(
  supabase: SupabaseClient,
  agentId: string,
  contacts: ParsedContact[],
  opts: { group: ContactGroup; source: ImportSource },
): Promise<ImportOutcome> {
  const existing = await loadExistingContacts(supabase, agentId);
  const { items, counts } = planImport(existing, contacts);

  const skipped: ImportNote[] = [];
  const warnings: ImportNote[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (const it of items) {
    const row = it.index + 1;
    const c = it.contact;
    if (it.status === "existing") {
      skipped.push({ row, name: c.name, reason: `Already in Aria${it.existingName && it.existingName !== c.name ? ` as ${it.existingName}` : ""}` });
      continue;
    }
    if (it.status === "no_contact") {
      skipped.push({ row, name: c.name, reason: "No phone or email" });
      continue;
    }
    if (it.status === "duplicate") continue; // merged into an earlier row
    for (const bad of c.invalid) warnings.push({ row, name: c.name, reason: `"${bad}" isn't a full phone number or email — left out` });

    const lead = opts.group === "lead";
    toInsert.push({
      agent_id: agentId,
      name: c.name,
      email: c.emails[0] ?? null,
      phone: c.phones[0] ?? null,
      emails: c.emails,
      phones: c.phones,
      address: c.address,
      town: c.town,
      // Where a lead wants to buy; for people she knows the city is just where they live.
      preferred_towns: lead && c.town ? [c.town] : null,
      notes: [c.notes, c.company ? `Company: ${c.company}` : null].filter(Boolean).join("\n") || null,
      birthday: birthdayForDb(c.birthday),
      client_role: c.role ?? "buyer",
      budget_min: c.budgetMin,
      budget_max: c.budgetMax,
      source: clientSourceFor(opts.source),
      lead_source: `import_${opts.source}`,
      contact_group: opts.group,
      // Known people (sphere, past clients) aren't brand-new leads.
      status: lead ? "new" : "contacted",
    });
  }

  const insertedIds: string[] = [];
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const { data, error } = await supabase.from("clients").insert(chunk).select("id");
    if (error) {
      // Report the failed chunk instead of failing the rows that already went in.
      console.error("[client-import] insert failed", error.message);
      for (const r of chunk) skipped.push({ row: 0, name: String(r.name), reason: `Couldn't save: ${error.message}` });
      continue;
    }
    for (const r of data ?? []) insertedIds.push(String(r.id));
  }

  return {
    inserted: insertedIds.length,
    existing: counts.existing,
    noContact: counts.noContact,
    duplicates: counts.duplicate,
    skipped,
    warnings,
    insertedIds,
  };
}

/** Request bodies come from the browser: keep only the fields and shapes we expect. */
export function sanitizeContacts(raw: unknown): ParsedContact[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : null);
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 200)).filter((x): x is string => Boolean(x)).slice(0, 10) : []);
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return raw.slice(0, MAX_IMPORT_ROWS).map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const role = o.role === "seller" || o.role === "renter" || o.role === "buyer" ? o.role : null;
    const birthday = str(o.birthday, 10);
    return {
      name: str(o.name, 200) ?? "",
      emails: list(o.emails),
      phones: list(o.phones),
      address: str(o.address, 300),
      town: str(o.town, 80),
      notes: str(o.notes, 2000),
      birthday: birthday && /^(\d{4}-\d{2}-\d{2}|--\d{2}-\d{2})$/.test(birthday) ? birthday : null,
      company: str(o.company, 120),
      role,
      budgetMin: numOrNull(o.budgetMin),
      budgetMax: numOrNull(o.budgetMax),
    };
  });
}
