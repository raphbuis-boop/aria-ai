import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { importContacts, MAX_IMPORT_ROWS, sanitizeContacts } from "@/lib/client-import";
import type { ContactGroup, ImportSource } from "@/lib/contacts/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROUPS = new Set<ContactGroup>(["sphere", "past_client", "lead"]);
const SOURCES = new Set<ImportSource>(["file", "paste", "phone"]);

/**
 * POST /api/clients/import { contacts, group, source }
 * Contacts parsed in the browser from a file, a pasted list or the iPhone
 * address book (Google Contacts imports go through /api/contacts/google, which
 * re-reads them from Google). De-duped and saved by lib/client-import.ts.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { contacts?: unknown; group?: unknown; source?: unknown };
  if (Array.isArray(body.contacts) && body.contacts.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `That's ${body.contacts.length} contacts — the limit is ${MAX_IMPORT_ROWS} per import.` },
      { status: 400 },
    );
  }
  const contacts = sanitizeContacts(body.contacts);
  if (!contacts.length) return NextResponse.json({ error: "No contacts to import" }, { status: 400 });
  const group: ContactGroup = GROUPS.has(body.group as ContactGroup) ? (body.group as ContactGroup) : "sphere";
  const source: ImportSource = SOURCES.has(body.source as ImportSource) ? (body.source as ImportSource) : "file";

  try {
    return NextResponse.json(await importContacts(supabase, user.id, contacts, { group, source }));
  } catch (error) {
    console.error("[clients/import] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Import failed. Nothing was changed — try again." }, { status: 500 });
  }
}
