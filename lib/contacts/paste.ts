import type { ParsedContact, Table } from "./types";
import { parseCsv, parseCsvRows } from "./csv";
import { looksLikeHeaderRow } from "./columns";
import { normalizeName } from "./normalize";

/**
 * Pasted text → either a table (copied from a spreadsheet, or CSV with a
 * header row) that goes through column mapping, or contacts parsed line by
 * line: "Dana Reyes, 201-555-0134, dana@example.com", "Dana Reyes
 * <dana@example.com>", "Dana Reyes 2015550134" — any order.
 */
export type PasteResult = { kind: "table"; table: Table } | { kind: "contacts"; contacts: ParsedContact[] };

const EMAIL_G = /[^\s<>(),;:"']+@[^\s<>(),;:"']+\.[A-Za-z]{2,}/g;
// 10–11 digit US numbers with common separators, or +international.
const PHONE_G = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?|\+\d[\d\s.-]{8,16}\d/g;

export function parsePastedLine(line: string): ParsedContact | null {
  const emails = line.match(EMAIL_G) ?? [];
  let rest = line.replace(EMAIL_G, " ");
  const phones = rest.match(PHONE_G)?.map((p) => p.trim()) ?? [];
  rest = rest.replace(PHONE_G, " ");
  // What's left is the name: drop separators and labels like "cell:" / "email".
  const name = normalizeName(
    rest
      .replace(/\b(cell|mobile|phone|tel|home|work|email|e-mail)\b\s*:?/gi, " ")
      .replace(/[<>()[\]{}|;:,\t"]+/g, " ")
      .replace(/\s[-–—/]\s/g, " ")
      .replace(/^[\s\-–—/.,]+|[\s\-–—/.,]+$/g, ""),
  );
  if (!name && !emails.length && !phones.length) return null;
  return { name, emails, phones };
}

export function parsePastedText(text: string): PasteResult {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/).filter((l) => l.trim());
  if (!lines.length) return { kind: "contacts", contacts: [] };

  // Copied from Excel/Sheets/Numbers: tab-separated cells.
  const tabbed = lines.filter((l) => l.includes("\t")).length >= Math.ceil(lines.length / 2);
  if (tabbed) {
    const rows = parseCsvRows(lines.join("\n"), "\t");
    if (rows.length > 1 && looksLikeHeaderRow(rows[0])) {
      return { kind: "table", table: parseCsv(lines.join("\n"), "\t") };
    }
    return { kind: "contacts", contacts: rows.map((r) => parsePastedLine(r.join(", "))).filter((c): c is ParsedContact => c !== null) };
  }

  // CSV with a header row ("Name,Email,Phone").
  if (lines.length > 1 && lines[0].includes(",")) {
    const header = parseCsvRows(lines[0], ",")[0] ?? [];
    if (header.length > 1 && looksLikeHeaderRow(header)) {
      return { kind: "table", table: parseCsv(lines.join("\n"), ",") };
    }
  }

  return { kind: "contacts", contacts: lines.map(parsePastedLine).filter((c): c is ParsedContact => c !== null) };
}
