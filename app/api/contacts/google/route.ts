import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { importContacts } from "@/lib/client-import";
import { listGoogleContacts } from "@/lib/google-contacts";
import type { ContactGroup } from "@/lib/contacts/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const GROUPS = new Set<ContactGroup>(["sphere", "past_client", "lead"]);

/**
 * GET  /api/contacts/google — the agent's Google Contacts, with every email
 *      and phone. The import screen previews them (new / already in Aria /
 *      no phone or email) against her clients itself.
 * POST /api/contacts/google { resourceNames, group } — imports the chosen
 *      contacts. They're re-read from Google server-side; the browser only
 *      sends which ones.
 */
export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await listGoogleContacts(user.id));
  } catch {
    return NextResponse.json({ status: "error", error: "Couldn't read your Google Contacts. Try again." });
  }
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { resourceNames?: unknown; group?: unknown };
  const wanted = new Set(Array.isArray(body.resourceNames) ? body.resourceNames.filter((r): r is string => typeof r === "string") : []);
  if (!wanted.size) return NextResponse.json({ error: "Pick at least one contact" }, { status: 400 });
  const group: ContactGroup = GROUPS.has(body.group as ContactGroup) ? (body.group as ContactGroup) : "sphere";

  try {
    const listing = await listGoogleContacts(user.id);
    if (listing.status !== "ok") return NextResponse.json(listing, { status: 409 });
    const chosen = listing.contacts.filter((c) => wanted.has(c.resourceName));
    return NextResponse.json(await importContacts(supabase, user.id, chosen, { group, source: "google" }));
  } catch {
    return NextResponse.json({ error: "Import failed. Nothing was changed — try again." }, { status: 500 });
  }
}
