import type { ParsedContact, Table } from "./types";
import { normalizeName, parseBirthday, parseMoney, parseRole, splitMulti } from "./normalize";

/**
 * Column mapping for spreadsheet-shaped imports (CSV, XLSX, pasted tables).
 * Headers from Google, Outlook, iCloud-to-CSV converters and common CRMs are
 * recognized; anything else can be set by hand in the mapping step. Several
 * columns may map to email or phone — every one of them is imported.
 */
export type ContactField =
  | "name"
  | "first_name"
  | "middle_name"
  | "last_name"
  | "email"
  | "phone"
  | "address"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "town"
  | "notes"
  | "birthday"
  | "company"
  | "role"
  | "budget_min"
  | "budget_max"
  | "skip";

export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: "Full name",
  first_name: "First name",
  middle_name: "Middle name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address (full)",
  street: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  town: "Preferred town / area",
  notes: "Notes",
  birthday: "Birthday",
  company: "Company",
  role: "Buyer / seller / renter",
  budget_min: "Budget min",
  budget_max: "Budget max",
  skip: "— Don't import —",
};

export const CONTACT_FIELDS = Object.keys(CONTACT_FIELD_LABELS) as ContactField[];

export type ColumnMapping = { field: ContactField; confident: boolean };

/** "E-mail 1 - Value" → "e mail 1 value" */
function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-./():#]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT: Record<string, ContactField> = {
  name: "name", "full name": "name", fullname: "name", "display name": "name", "contact name": "name",
  "client name": "name", "lead name": "name", contact: "name", client: "name",
  "first name": "first_name", firstname: "first_name", first: "first_name", "given name": "first_name", fname: "first_name",
  "middle name": "middle_name", "additional name": "middle_name",
  "last name": "last_name", lastname: "last_name", last: "last_name", surname: "last_name", "family name": "last_name", lname: "last_name",
  notes: "notes", note: "notes", comments: "notes", comment: "notes", description: "notes", memo: "notes",
  birthday: "birthday", "birth date": "birthday", birthdate: "birthday", dob: "birthday", "date of birth": "birthday",
  company: "company", organization: "company", "organization name": "company", "organization 1 name": "company", employer: "company",
  "client type": "role", "lead type": "role", role: "role", "client role": "role", "buyer seller": "role",
  budget: "budget_max", "max price": "budget_max", "price max": "budget_max", "budget max": "budget_max", "max budget": "budget_max",
  "maximum price": "budget_max", price: "budget_max",
  "min price": "budget_min", "price min": "budget_min", "budget min": "budget_min", "min budget": "budget_min", "minimum price": "budget_min",
  town: "town", area: "town", "preferred town": "town", "preferred area": "town", "preferred towns": "town",
  location: "town", neighborhood: "town", "desired area": "town",
  address: "address", "full address": "address", "home address": "address", "mailing address": "address",
  "street address": "address", "address 1 formatted": "address", "property address": "address",
  street: "street", "home street": "street", "address line 1": "street", "address 1 street": "street", "street 1": "street",
  city: "city", "home city": "city", "address 1 city": "city",
  state: "state", "home state": "state", region: "state", province: "state", "address 1 region": "state",
  zip: "zip", "zip code": "zip", zipcode: "zip", "postal code": "zip", postcode: "zip", "home postal code": "zip",
  "address 1 postal code": "zip",
};

/** Best guess for one header. `confident` = an exact known header. */
export function guessField(header: string): ColumnMapping {
  const h = normHeader(header);
  if (!h) return { field: "skip", confident: false };
  if (EXACT[h]) return { field: EXACT[h], confident: true };
  // "Phone 1 - Type", "E-mail 2 - Label": the kind of value, not the value.
  if (/\b(type|label)$/.test(h)) return { field: "skip", confident: true };
  if (/\b(fax|pager|assistants?|prefix|suffix|phonetic|yomi|nickname|title|initials|gender|anniversary|web|url|website|group|labels)\b/.test(h)) {
    return { field: "skip", confident: true };
  }
  if (/\be ?mail\b|\bemails?\b/.test(h)) return { field: "email", confident: true };
  if (/\b(phone|phones|mobile|cell|cellphone|telephone|tel)\b/.test(h)) return { field: "phone", confident: true };
  if (/\bbirth/.test(h)) return { field: "birthday", confident: false };
  if (/\bnote/.test(h)) return { field: "notes", confident: false };
  if (/\b(postal|zip)\b/.test(h)) return { field: "zip", confident: false };
  if (/\bcity\b/.test(h)) return { field: "city", confident: false };
  if (/\bstreet\b/.test(h)) return { field: "street", confident: false };
  if (/\baddress\b/.test(h)) return { field: "address", confident: false };
  if (/\bfirst\b/.test(h)) return { field: "first_name", confident: false };
  if (/\blast\b/.test(h)) return { field: "last_name", confident: false };
  if (/\bname\b/.test(h)) return { field: "name", confident: false };
  return { field: "skip", confident: false };
}

/**
 * Auto-maps every column. A field that can hold only one column (everything
 * but email and phone) keeps its first match; later duplicates are skipped.
 */
export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const taken = new Set<ContactField>();
  return headers.map((h) => {
    const m = guessField(h);
    if (m.field === "skip" || m.field === "email" || m.field === "phone") return m;
    if (taken.has(m.field)) return { field: "skip", confident: false };
    taken.add(m.field);
    return m;
  });
}

/** True when a row looks like headers rather than data (no emails or phone numbers in it). */
export function looksLikeHeaderRow(cells: string[]): boolean {
  const known = cells.filter((c) => guessField(c).field !== "skip").length;
  const dataLike = cells.some((c) => /@/.test(c) || (c.replace(/\D/g, "").length >= 7 && /^[\d\s()+.-]+$/.test(c)));
  return known >= 1 && !dataLike;
}

/** Applies a mapping to every row. Rows with no name, email or phone are dropped. */
export function tableToContacts(table: Table, mapping: ColumnMapping[]): ParsedContact[] {
  const out: ParsedContact[] = [];
  for (const row of table.rows) {
    const one: Partial<Record<ContactField, string>> = {};
    const emails: string[] = [];
    const phones: string[] = [];
    mapping.forEach((m, i) => {
      const v = (row[i] ?? "").trim();
      if (!v || m.field === "skip") return;
      if (m.field === "email") emails.push(...splitMulti(v));
      else if (m.field === "phone") phones.push(...splitMulti(v));
      else if (!one[m.field]) one[m.field] = v;
    });

    const name =
      normalizeName(one.name) ||
      normalizeName([one.first_name, one.middle_name, one.last_name].filter(Boolean).join(" "));
    if (!name && !emails.length && !phones.length) continue;

    const street = one.street;
    const city = one.city?.trim() || null;
    const address =
      one.address?.replace(/\s*\n\s*/g, ", ").trim() ||
      [street, city, [one.state, one.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") ||
      null;

    out.push({
      name,
      emails,
      phones,
      address,
      town: one.town?.trim() || city,
      notes: one.notes?.trim() || null,
      birthday: parseBirthday(one.birthday),
      company: one.company?.trim() || null,
      role: parseRole(one.role),
      budgetMin: parseMoney(one.budget_min),
      budgetMax: parseMoney(one.budget_max),
    });
  }
  return out;
}
