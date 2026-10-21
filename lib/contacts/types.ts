/**
 * One contact as read from any import source (Google, a CSV/XLSX file, a
 * vCard, pasted text, the iPhone address book) before normalization. Values
 * are as found; lib/contacts/plan.ts normalizes and de-dupes them.
 */
export type ParsedContact = {
  name: string;
  /** Every email found, in source order (first = primary). */
  emails: string[];
  /** Every phone found, in source order (first = primary). */
  phones: string[];
  address?: string | null;
  /** City from the address, or a preferred town/area column. */
  town?: string | null;
  notes?: string | null;
  /** "YYYY-MM-DD", or "--MM-DD" when the year isn't known. */
  birthday?: string | null;
  company?: string | null;
  role?: "buyer" | "seller" | "renter" | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

/** A spreadsheet-shaped source (CSV, XLSX, tab-separated paste) before column mapping. */
export type Table = { headers: string[]; rows: string[][] };

/** Where an import came from — stored as clients.lead_source = `import_${source}`. */
export type ImportSource = "google" | "file" | "paste" | "phone";

/** What the agent says the imported people are. */
export type ContactGroup = "sphere" | "past_client" | "lead";

export const CONTACT_GROUP_LABELS: Record<ContactGroup, string> = {
  sphere: "Sphere",
  past_client: "Past client",
  lead: "Active lead",
};
