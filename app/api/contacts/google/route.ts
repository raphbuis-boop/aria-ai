import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { importClients, normalizeEmail, type ImportGroup } from "@/lib/client-import";
import { listGoogleContacts } from "@/lib/google-contacts";
import { formatPhoneE164 } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET  /api/contacts/google — the agent's Google Contacts, each flagged if
 *      they're already a client (so the picker can pre-skip them).
 * POST /api/contacts/google { resourceNames, group } — imports the chosen
 *      contacts. Contacts are re-read from Google server-side; the browser
 *      only sends which ones.
 */
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const listing = await listGoogleContacts(user.id);
    if (listing.status !== "ok") return NextResponse.json(listing);

    const { data: existing } = await supabase.from("clients").select("email, phone").eq("agent_id", user.id);
    const emails = new Set((existing ?? []).map((c) => normalizeEmail(c.email)).filter(Boolean));
    const phones = new Set((existing ?? []).map((c) => (c.phone ? formatPhoneE164(String(c.phone)) : null)).filter(Boolean));
    return NextResponse.json({
      status: "ok",
      truncated: listing.truncated,
      contacts: listing.contacts.map((c) => ({
        ...c,
        alreadyClient: Boolean((c.email && emails.has(c.email)) || (c.phone && phones.has(c.phone))),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't read your Google Contacts. Try again." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { resourceNames?: unknown; group?: unknown };
  const wanted = new Set(Array.isArray(body.resourceNames) ? body.resourceNames.filter((r): r is string => typeof r === "string") : []);
  if (!wanted.size) return NextResponse.json({ error: "Pick at least one contact" }, { status: 400 });
  const group: ImportGroup = body.group === "leads" ? "leads" : "sphere";

  try {
    const listing = await listGoogleContacts(user.id);
    if (listing.status !== "ok") return NextResponse.json(listing, { status: 409 });
    const chosen = listing.contacts.filter((c) => wanted.has(c.resourceName));
    const result = await importClients(
      supabase,
      user.id,
      chosen.map((c) => ({ name: c.name, email: c.email, phone: c.phone ?? c.rawPhone, town: c.town })),
      { group, defaultSource: "google_contacts" },
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Import failed. Nothing was changed — try again." }, { status: 502 });
  }
}
