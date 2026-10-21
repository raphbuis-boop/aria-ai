import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/gmail";
import { MAX_IMPORT_ROWS } from "@/lib/client-import";
import { normalizeName, parseBirthday } from "@/lib/contacts/normalize";
import type { ParsedContact } from "@/lib/contacts/types";

export const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";

/** Local end-to-end testing only (same switch as lib/gmail.ts). */
const TEST_API_BASE = process.env.GOOGLE_API_BASE_URL?.replace(/\/$/, "") || null;

/** A Google contact with every email and phone it has. */
export type GoogleContact = ParsedContact & { resourceName: string };

export type ContactsListing =
  | { status: "ok"; contacts: GoogleContact[]; truncated: boolean }
  | { status: "not_connected" }
  | { status: "needs_scope" };

type GDate = { year?: number | null; month?: number | null; day?: number | null } | null | undefined;

function birthdayOf(d: GDate): string | null {
  if (!d?.month || !d.day) return null;
  const mmdd = `${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return parseBirthday(d.year ? `${d.year}-${mmdd}` : `--${mmdd}`);
}

/** The agent's Google Contacts ("My Contacts"). Read-only. */
export async function listGoogleContacts(agentId: string): Promise<ContactsListing> {
  const g = await getGoogleAuth(agentId);
  if (!g) return { status: "not_connected" };
  // Accounts connected before contacts were requested don't have the scope.
  if (g.scopes.length && !g.scopes.includes(CONTACTS_SCOPE)) return { status: "needs_scope" };

  const people = google.people({ version: "v1", auth: g.auth, ...(TEST_API_BASE ? { rootUrl: `${TEST_API_BASE}/` } : {}) });
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;
  let truncated = false;
  try {
    do {
      const res = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        pageToken,
        personFields: "names,emailAddresses,phoneNumbers,addresses,birthdays,biographies,organizations",
        sortOrder: "FIRST_NAME_ASCENDING",
      });
      for (const p of res.data.connections ?? []) {
        // Every address and number, primary first.
        const emails = [...(p.emailAddresses ?? [])]
          .sort((a, b) => Number(Boolean(b.metadata?.primary)) - Number(Boolean(a.metadata?.primary)))
          .map((e) => e.value?.trim() ?? "")
          .filter(Boolean);
        const phones = [...(p.phoneNumbers ?? [])]
          .sort((a, b) => Number(Boolean(b.metadata?.primary)) - Number(Boolean(a.metadata?.primary)))
          .map((n) => n.value?.trim() ?? "")
          .filter(Boolean);
        const name = normalizeName(p.names?.[0]?.displayName);
        if (!p.resourceName || (!name && !emails.length && !phones.length)) continue;
        const addr = p.addresses?.find((a) => a.metadata?.primary) ?? p.addresses?.[0];
        contacts.push({
          resourceName: p.resourceName,
          name,
          emails,
          phones,
          address: addr?.formattedValue?.replace(/\s*\n\s*/g, ", ").trim() || null,
          town: addr?.city?.trim() || null,
          notes: p.biographies?.[0]?.value?.trim() || null,
          birthday: birthdayOf(p.birthdays?.find((b) => b.date)?.date),
          company: p.organizations?.[0]?.name?.trim() || null,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (contacts.length >= MAX_IMPORT_ROWS) {
        truncated = Boolean(pageToken);
        break;
      }
    } while (pageToken);
  } catch (error) {
    const status = (error as { code?: number; response?: { status?: number } })?.response?.status ?? (error as { code?: number }).code;
    if (status === 403) return { status: "needs_scope" };
    // Log the message only: Gaxios errors embed credentials in their config.
    console.error("[google-contacts] list failed", agentId, status ?? null, error instanceof Error ? error.message : "unknown");
    throw new Error("Couldn't read Google Contacts");
  }
  return { status: "ok", contacts: contacts.slice(0, MAX_IMPORT_ROWS), truncated };
}
