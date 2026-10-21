import type { Table } from "./types";

/** Picks the delimiter that splits the header line into the most columns. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * RFC 4180 CSV → rows of cells. Handles quoted fields with commas, doubled
 * quotes and line breaks inside them (Google/Outlook exports put multi-line
 * notes and addresses in one cell), CRLF/LF/CR line ends, a UTF-8 BOM, and
 * comma, semicolon or tab delimiters. Fully empty rows are dropped.
 */
export function parseCsvRows(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      cell = "";
      quoted = true;
    } else if (ch === d) {
      endCell();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else if (ch === "\n") {
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

/** CSV text → header row + data rows (each padded to the header width). */
export function parseCsv(input: string, delimiter?: string): Table {
  const [headerRow = [], ...rest] = parseCsvRows(input, delimiter);
  const headers = headerRow.map((h) => h.replace(/^["']|["']$/g, "").trim());
  const rows = rest.map((r) => headers.map((_, i) => r[i] ?? ""));
  return { headers, rows };
}
