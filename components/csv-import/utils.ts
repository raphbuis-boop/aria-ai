// ── CSV parser ────────────────────────────────────────────────────────────────

export type ParsedCSV = {
  headers: string[];
  rows: string[][];
};

export function parseCSV(text: string): ParsedCSV {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]).map((h) =>
    h.replace(/^["']|["']$/g, "").trim(),
  );
  const rows = lines
    .slice(1)
    .filter((l) => l.trim())
    .map(parseLine);

  return { headers, rows };
}

// ── Budget parser ─────────────────────────────────────────────────────────────
// Handles: "$500k", "500,000", "$1.2M", "500000", "500k-600k"

export function parseBudget(val: string): number | null {
  if (!val?.trim()) return null;
  const c = val.replace(/[$,\s]/g, "").toLowerCase();
  if (c.endsWith("k")) {
    const n = parseFloat(c);
    return isNaN(n) ? null : Math.round(n * 1_000);
  }
  if (c.endsWith("m")) {
    const n = parseFloat(c);
    return isNaN(n) ? null : Math.round(n * 1_000_000);
  }
  const n = parseFloat(c);
  return isNaN(n) ? null : Math.round(n);
}

// ── Field mapping ─────────────────────────────────────────────────────────────

export type AriaField =
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "client_role"
  | "budget"
  | "budget_min"
  | "budget_max"
  | "town"
  | "notes"
  | "source"
  | "skip";

export const ARIA_FIELD_LABELS: Record<AriaField, string> = {
  name: "Full Name",
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email",
  phone: "Phone",
  client_role: "Client Type (buyer/seller)",
  budget: "Budget",
  budget_min: "Budget Min",
  budget_max: "Budget Max",
  town: "Preferred Town / Area",
  notes: "Notes",
  source: "Source",
  skip: "— Skip column —",
};

export const ALL_ARIA_FIELDS: AriaField[] = [
  "name", "first_name", "last_name", "email", "phone",
  "client_role", "budget", "budget_min", "budget_max",
  "town", "notes", "source", "skip",
];

export type FieldMapping = {
  header: string;
  field: AriaField;
  confidence: "high" | "low";
};

// ── Preview row ───────────────────────────────────────────────────────────────

export type PreviewRow = {
  _id: string;
  _deleted: boolean;
  name: string;
  email: string;
  phone: string;
  client_role: string;
  budget_min: string;
  budget_max: string;
  town: string;
  notes: string;
  source: string;
};

export function buildPreviewRows(
  headers: string[],
  rawRows: string[][],
  mapping: FieldMapping[],
): PreviewRow[] {
  // Build header → field lookup
  const headerToField = new Map<string, AriaField>(
    mapping.map((m) => [m.header, m.field]),
  );

  // For a given aria field, find the column index in headers
  const colFor = (field: AriaField): number =>
    headers.findIndex((h) => headerToField.get(h) === field);

  const getVal = (cols: string[], field: AriaField): string => {
    const idx = colFor(field);
    return idx >= 0 ? (cols[idx] ?? "").trim() : "";
  };

  return rawRows.map((cols, i) => {
    // Name: prefer combined "name" field, otherwise join first+last
    const nameDirect = getVal(cols, "name");
    const first = getVal(cols, "first_name");
    const last = getVal(cols, "last_name");
    const name = nameDirect || [first, last].filter(Boolean).join(" ");

    // Budget: "budget" single field maps to budget_max as default
    const budgetSingle = getVal(cols, "budget");
    const budgetMin = getVal(cols, "budget_min");
    const budgetMax = getVal(cols, "budget_max") || budgetSingle;

    return {
      _id: String(i),
      _deleted: false,
      name,
      email: getVal(cols, "email"),
      phone: getVal(cols, "phone"),
      client_role: getVal(cols, "client_role") || "buyer",
      budget_min: budgetMin,
      budget_max: budgetMax,
      town: getVal(cols, "town"),
      notes: getVal(cols, "notes"),
      source: getVal(cols, "source") || "csv_import",
    };
  });
}

// ── Import payload ────────────────────────────────────────────────────────────

export type ImportPayloadRow = {
  name: string;
  email: string | null;
  phone: string | null;
  client_role: "buyer" | "seller";
  budget_min: number | null;
  budget_max: number | null;
  town: string | null;
  notes: string | null;
  source: string | null;
};

export function buildImportPayload(rows: PreviewRow[]): ImportPayloadRow[] {
  return rows
    .filter((r) => !r._deleted && r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      email: r.email.trim() || null,
      phone: r.phone.trim() || null,
      client_role:
        r.client_role.toLowerCase() === "seller" ? "seller" : "buyer",
      budget_min: parseBudget(r.budget_min),
      budget_max: parseBudget(r.budget_max),
      town: r.town.trim() || null,
      notes: r.notes.trim() || null,
      source: r.source.trim() || "csv_import",
    }));
}
