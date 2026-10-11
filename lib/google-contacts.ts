import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/gmail";
import { MAX_IMPORT_ROWS, normalizeEmail, normalizeName } from "@/lib/client-import";
import { formatPhoneE164 } from "@/lib/utils";

export const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";

/** Local end-to-end testing only (same switch as lib/gmail.ts). */
const TEST_API_BASE = process.env.GOOGLE_API_BASE_URL?.replace(/\/$/, "") || null;

export type GoogleContact = {
  resourceName: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Phone as Google has it, shown when it can't be normalized. */
  rawPhone: string | null;
  town: string | null;
};

export type ContactsListing =
  | { status: "ok"; contacts: GoogleContact[]; truncated: boolean }
  | { status: "not_connected" }
  | { status: "needs_scope" };

/** The agent's Google Contacts ("My Contacts"), normalized. Read-only. */
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
        personFields: "names,emailAddresses,phoneNumbers,addresses",
        sortOrder: "FIRST_NAME_ASCENDING",
      });
      for (const p of res.data.connections ?? []) {
        const rawPhone = p.phoneNumbers?.find((x) => x.value)?.value?.trim() ?? null;
        const email = normalizeEmail(p.emailAddresses?.find((x) => x.value)?.value);
        const phone = rawPhone ? formatPhoneE164(rawPhone) : null;
        const name = normalizeName(p.names?.[0]?.displayName) || email || "";
        if (!p.resourceName || (!name && !phone)) continue;
        contacts.push({
          resourceName: p.resourceName,
          name: name || (phone ?? ""),
          email,
          phone,
          rawPhone,
          town: p.addresses?.find((a) => a.city)?.city?.trim() || null,
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
