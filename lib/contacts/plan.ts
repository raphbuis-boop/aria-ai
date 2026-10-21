import type { ParsedContact } from "./types";
import { normalizeEmail, normalizeName, normalizePhone } from "./normalize";
import { fmtPhone } from "@/lib/utils";

/**
 * Decides what happens to each contact in an import, before anything is
 * written. Pure (no I/O), so the import screen shows exactly what the server
 * will do: the browser runs it against the agent's clients for the preview,
 * and the server runs it again against the database when importing.
 */

/** An existing client's contact points (clients.email/phone + emails/phones). */
export type ExistingClient = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
};

export type NormalizedContact = {
  name: string;
  /** Valid, lowercased, de-duplicated; first is the primary. */
  emails: string[];
  /** E.164, de-duplicated; first is the primary. */
  phones: string[];
  /** Values that couldn't be read as an email or a full phone number (dropped). */
  invalid: string[];
  address: string | null;
  town: string | null;
  notes: string | null;
  birthday: string | null;
  company: string | null;
  role: "buyer" | "seller" | "renter" | null;
  budgetMin: number | null;
  budgetMax: number | null;
};

export type PlanStatus =
  /** Will be imported. */
  | "new"
  /** Matches a client already in Aria on an email or phone. */
  | "existing"
  /** No usable phone or email. */
  | "no_contact"
  /** Same person as an earlier contact in this import; merged into it. */
  | "duplicate";

export type PlannedContact = {
  index: number;
  status: PlanStatus;
  contact: NormalizedContact;
  /** For "existing": the client it matched. For "duplicate": the contact index it merged into. */
  existingName?: string;
  existingId?: string;
  duplicateOf?: number;
};

export type ImportCounts = { new: number; existing: number; noContact: number; duplicate: number };

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function clip(v: string | null | undefined, max: number): string | null {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
}

export function normalizeContact(c: ParsedContact): NormalizedContact {
  const invalid: string[] = [];
  const emails: string[] = [];
  for (const raw of c.emails ?? []) {
    const e = normalizeEmail(raw);
    if (e) emails.push(e);
    else if (raw.trim()) invalid.push(raw.trim());
  }
  const phones: string[] = [];
  for (const raw of c.phones ?? []) {
    const p = normalizePhone(raw);
    if (p) phones.push(p);
    else if (raw.trim()) invalid.push(raw.trim());
  }
  const uEmails = uniq(emails).slice(0, 10);
  const uPhones = uniq(phones).slice(0, 10);
  // Someone with no name still imports under their email or number.
  const name =
    normalizeName(c.name).slice(0, 120) || uEmails[0] || (uPhones[0] ? fmtPhone(uPhones[0]) : "");
  return {
    name,
    emails: uEmails,
    phones: uPhones,
    invalid,
    address: clip(c.address, 300),
    town: clip(c.town, 80),
    notes: clip(c.notes, 2000),
    birthday: c.birthday ?? null,
    company: clip(c.company, 120),
    role: c.role ?? null,
    budgetMin: c.budgetMin ?? null,
    budgetMax: c.budgetMax ?? null,
  };
}

/** Index of existing clients by every email and phone they have. */
function indexExisting(existing: ExistingClient[]) {
  const byEmail = new Map<string, ExistingClient>();
  const byPhone = new Map<string, ExistingClient>();
  for (const c of existing) {
    for (const raw of [c.email, ...(c.emails ?? [])]) {
      const e = normalizeEmail(raw);
      if (e && !byEmail.has(e)) byEmail.set(e, c);
    }
    for (const raw of [c.phone, ...(c.phones ?? [])]) {
      const p = normalizePhone(raw ?? null);
      if (p && !byPhone.has(p)) byPhone.set(p, c);
    }
  }
  return { byEmail, byPhone };
}

export function planImport(existing: ExistingClient[], contacts: ParsedContact[]): { items: PlannedContact[]; counts: ImportCounts } {
  const { byEmail, byPhone } = indexExisting(existing);
  // Contacts already planned as "new" in this import, by email/phone → item index.
  const seenEmail = new Map<string, number>();
  const seenPhone = new Map<string, number>();
  const items: PlannedContact[] = [];

  contacts.forEach((raw, index) => {
    const contact = normalizeContact(raw);
    if (!contact.emails.length && !contact.phones.length) {
      items.push({ index, status: "no_contact", contact });
      return;
    }
    const match =
      contact.emails.map((e) => byEmail.get(e)).find(Boolean) ?? contact.phones.map((p) => byPhone.get(p)).find(Boolean);
    if (match) {
      items.push({ index, status: "existing", contact, existingId: match.id, existingName: match.name ?? undefined });
      return;
    }
    const dupOf = contact.emails.map((e) => seenEmail.get(e)).find((i) => i !== undefined) ??
      contact.phones.map((p) => seenPhone.get(p)).find((i) => i !== undefined);
    if (dupOf !== undefined) {
      // Same person listed twice (common in phone exports): keep one, with every email and number.
      const first = items[dupOf].contact;
      first.emails = uniq([...first.emails, ...contact.emails]).slice(0, 10);
      first.phones = uniq([...first.phones, ...contact.phones]).slice(0, 10);
      for (const e of first.emails) seenEmail.set(e, dupOf);
      for (const p of first.phones) seenPhone.set(p, dupOf);
      items.push({ index, status: "duplicate", contact, duplicateOf: dupOf });
      return;
    }
    for (const e of contact.emails) seenEmail.set(e, items.length);
    for (const p of contact.phones) seenPhone.set(p, items.length);
    items.push({ index, status: "new", contact });
  });

  const counts: ImportCounts = { new: 0, existing: 0, noContact: 0, duplicate: 0 };
  for (const it of items) {
    if (it.status === "new") counts.new++;
    else if (it.status === "existing") counts.existing++;
    else if (it.status === "no_contact") counts.noContact++;
    else counts.duplicate++;
  }
  return { items, counts };
}

/** "12 new, 3 already in Aria, 2 skipped (no phone or email)" */
export function countsLine(c: ImportCounts): string {
  const parts = [`${c.new} new`, `${c.existing} already in Aria`, `${c.noContact} skipped (no phone or email)`];
  if (c.duplicate) parts.push(`${c.duplicate} duplicate${c.duplicate === 1 ? "" : "s"} merged`);
  return parts.join(", ");
}
