import type { Table } from "./types";

type Cell = string | number | boolean | Date | null | undefined;

function cellText(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  // Phone numbers typed into Excel come back as numbers: 2015550134 → "2015550134".
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

/**
 * First sheet of a workbook (rows of cells, as read-excel-file returns them)
 * → header row + data rows. Leading blank rows are skipped; dates become
 * YYYY-MM-DD so the birthday parser can read them.
 */
export function sheetToTable(sheet: Cell[][]): Table {
  const rows = sheet.map((r) => r.map(cellText)).filter((r) => r.some((c) => c !== ""));
  const [headerRow = [], ...rest] = rows;
  const headers = headerRow.map((h) => h.trim());
  return { headers, rows: rest.map((r) => headers.map((_, i) => r[i] ?? "")) };
}

/** Reads an .xlsx File in the browser. */
export async function readXlsxFile(file: File): Promise<Table> {
  const { readSheet } = await import("read-excel-file/browser");
  const data = await readSheet(file);
  return sheetToTable(data as unknown as Cell[][]);
}
