import { formatPhoneE164 } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase().replace(/^mailto:/, "") : "";
  return EMAIL_RE.test(v) ? v : null;
}

/** E.164 (+12015550134) or null when it isn't a full number. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const v = String(raw).trim().replace(/^tel:/i, "");
  return v ? formatPhoneE164(v) : null;
}

/** Collapses whitespace and strips stray quotes: '  "Dana   Reyes" ' → 'Dana Reyes'. */
export function normalizeName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, " ").trim() : "";
}

/** Splits an email/phone cell that holds several values ("a@x.com ::: b@y.com", "a; b", "a, b"). */
export function splitMulti(raw: unknown): string[] {
  if (typeof raw !== "string" && typeof raw !== "number") return [];
  return String(raw)
    .split(/\s*(?::::|[;,\n|])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function validDay(month: number, day: number) {
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function ymd(year: number | null, month: number, day: number): string | null {
  if (!validDay(month, day)) return null;
  if (year === null) return `--${pad2(month)}-${pad2(day)}`;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Birthday in the formats contact exports use: 1985-07-04, 19850704,
 * --0704 / --07-04 (vCard, no year), 07/04/1985 or 7/4 (US order),
 * "July 4, 1985", a Date, or an Excel date serial. Returns "YYYY-MM-DD",
 * "--MM-DD" (year unknown), or null.
 */
export function parseBirthday(raw: unknown): string | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : ymd(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  if (typeof raw === "number") {
    // Excel serial date (days since 1899-12-30).
    if (raw < 1 || raw > 80_000) return null;
    return parseBirthday(new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86_400_000));
  }
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  let m = v.match(/^--(\d{2})-?(\d{2})$/);
  if (m) return ymd(null, Number(m[1]), Number(m[2]));
  m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:T.*)?$/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (m) {
    let year = m[3] ? Number(m[3]) : null;
    if (year !== null && m[3].length === 2) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
    return ymd(year, Number(m[1]), Number(m[2]));
  }
  m = v.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return month ? ymd(m[3] ? Number(m[3]) : null, month, Number(m[2])) : null;
  }
  return null;
}

/**
 * clients.birthday is a DATE. Only month and day are ever used (birthday
 * reminders), so a birthday without a year is stored in 1904 — a leap year,
 * so Feb 29 survives.
 */
export function birthdayForDb(birthday: string | null | undefined): string | null {
  if (!birthday) return null;
  return birthday.startsWith("--") ? `1904-${birthday.slice(2)}` : birthday;
}

export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)([km]m?)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2]?.startsWith("m") ? 1_000_000 : m[2] === "k" ? 1_000 : 1);
  return n > 0 ? Math.round(n) : null;
}

export function parseRole(raw: unknown): "buyer" | "seller" | "renter" | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return null;
  if (/sell|listing/.test(v)) return "seller";
  if (/rent|tenant|lease/.test(v)) return "renter";
  if (/buy|purchas/.test(v)) return "buyer";
  return null;
}
