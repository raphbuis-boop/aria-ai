import type { ParsedContact } from "./types";
import { normalizeName, parseBirthday } from "./normalize";

/**
 * vCard (.vcf) → contacts. Covers what iPhone/iCloud (vCard 3.0), Android
 * and Google (2.1/3.0) and newer apps (4.0) export:
 *  - several cards per file, folded lines, `item1.EMAIL` grouped properties
 *  - QUOTED-PRINTABLE values with soft line breaks (vCard 2.1), UTF-8
 *  - escaped \, \; \n in values; `tel:` URIs (4.0)
 *  - FN / N, EMAIL, TEL, ADR, NOTE, BDAY, ORG (every EMAIL and TEL is kept)
 * PHOTO and other properties are ignored.
 */

type Prop = { name: string; params: Record<string, string[]>; value: string };

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  const v = value.replace(/=\r?\n/g, "");
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(v.slice(i + 1, i + 3))) {
      bytes.push(parseInt(v.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      // Non-ASCII characters left unencoded: keep their UTF-8 bytes.
      for (const b of new TextEncoder().encode(v[i])) bytes.push(b);
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function unescapeText(v: string): string {
  return v.replace(/\\([\\,;nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/** Splits on unescaped `;` (structured values like N and ADR). */
function splitStructured(v: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      cur += v[i] + v[i + 1];
      i++;
    } else if (v[i] === ";") {
      parts.push(cur);
      cur = "";
    } else {
      cur += v[i];
    }
  }
  parts.push(cur);
  return parts.map((p) => unescapeText(p).trim());
}

/** Joins folded lines (and QUOTED-PRINTABLE soft breaks) into logical lines. */
function unfold(text: string): string[] {
  const raw = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const line of raw) {
    const prev = lines.length - 1;
    if (prev >= 0 && /^[ \t]/.test(line)) {
      lines[prev] += line.slice(1);
    } else if (prev >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(lines[prev].split(":")[0]) && lines[prev].endsWith("=")) {
      lines[prev] = lines[prev].slice(0, -1) + line;
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseLine(line: string): Prop | null {
  // The value starts at the first ':' outside a quoted parameter value.
  let colon = -1;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(";");
  const name = rawName.replace(/^[^.]*\./, "").trim().toUpperCase(); // drop "item1." groups
  const params: Record<string, string[]> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    // vCard 2.1 bare params ("TEL;CELL:") are types.
    const key = (eq < 0 ? "TYPE" : p.slice(0, eq)).trim().toUpperCase();
    const vals = (eq < 0 ? p : p.slice(eq + 1)).replace(/"/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    params[key] = [...(params[key] ?? []), ...vals];
  }
  let value = line.slice(colon + 1);
  if (params.ENCODING?.some((e) => /quoted-printable/i.test(e))) value = decodeQuotedPrintable(value);
  return { name, params, value };
}

function addressFrom(parts: string[]): { address: string | null; city: string | null } {
  // ADR: PO box; extended; street; locality; region; postal code; country
  const [pobox, ext, street, city, region, zip, country] = parts;
  const line1 = [street, ext, pobox].filter(Boolean).join(" ").replace(/\s*\n\s*/g, ", ");
  const regionZip = [region, zip].filter(Boolean).join(" ");
  const address = [line1, city, regionZip, country].filter(Boolean).join(", ") || null;
  return { address, city: city || null };
}

export function parseVcf(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  let card: Prop[] | null = null;

  for (const line of unfold(text)) {
    if (!line.trim()) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN" && /vcard/i.test(prop.value)) {
      card = [];
      continue;
    }
    if (prop.name === "END" && /vcard/i.test(prop.value)) {
      if (card) {
        const c = cardToContact(card);
        if (c) contacts.push(c);
      }
      card = null;
      continue;
    }
    card?.push(prop);
  }
  return contacts;
}

function cardToContact(props: Prop[]): ParsedContact | null {
  const get = (n: string) => props.filter((p) => p.name === n);
  const isPref = (p: Prop) => (p.params.TYPE ?? []).some((t) => t.toLowerCase() === "pref") || p.params.PREF !== undefined;
  // Preferred values first, otherwise file order.
  const ordered = (n: string) => {
    const all = get(n);
    return [...all.filter(isPref), ...all.filter((p) => !isPref(p))];
  };

  const fn = normalizeName(unescapeText(get("FN")[0]?.value ?? ""));
  const n = get("N")[0] ? splitStructured(get("N")[0].value) : [];
  // N: family; given; additional; prefix; suffix
  const fromN = normalizeName([n[1], n[2], n[0]].filter(Boolean).join(" "));
  const org = get("ORG")[0] ? splitStructured(get("ORG")[0].value)[0] || null : null;

  const emails = ordered("EMAIL").map((p) => unescapeText(p.value).trim()).filter(Boolean);
  const phones = ordered("TEL")
    .map((p) => unescapeText(p.value).trim().replace(/^tel:/i, ""))
    .filter(Boolean);

  const adr = ordered("ADR")[0];
  const { address, city } = adr ? addressFrom(splitStructured(adr.value)) : { address: null, city: null };

  const notes = get("NOTE")
    .map((p) => unescapeText(p.value).trim())
    .filter(Boolean)
    .join("\n") || null;

  // Companies with no person name (e.g. "Acme Title Co") still import under the company name.
  const name = fn || fromN || org || "";
  if (!name && !emails.length && !phones.length) return null;

  return {
    name,
    emails,
    phones,
    address,
    town: city,
    notes,
    birthday: birthdayOf(get("BDAY")[0]),
    company: org && org !== name ? org : null,
  };
}

/** iPhone stores a birthday without a year as 1604-MM-DD plus X-APPLE-OMIT-YEAR=1604. */
function birthdayOf(p: Prop | undefined): string | null {
  if (!p) return null;
  const v = p.value.trim();
  const omitYear = p.params["X-APPLE-OMIT-YEAR"]?.[0];
  const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m && (m[1] === omitYear || m[1] === "1604")) return parseBirthday(`--${m[2]}-${m[3]}`);
  return parseBirthday(v);
}
