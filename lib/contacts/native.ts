"use client";

import { Capacitor } from "@capacitor/core";
import type { ContactPayload } from "@capacitor-community/contacts";
import type { ParsedContact } from "./types";
import { normalizeName, parseBirthday } from "./normalize";

/**
 * The iPhone address book, through @capacitor-community/contacts. Only works
 * inside the Capacitor iOS app (the plugin is compiled into the app binary);
 * on the web every caller checks isNativeApp() first and hides the option.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const PROJECTION = {
  name: true,
  phones: true,
  emails: true,
  postalAddresses: true,
  birthday: true,
  note: true,
  organization: true,
};

export function fromNativeContact(c: ContactPayload): ParsedContact {
  const name = normalizeName(
    c.name?.display || [c.name?.given, c.name?.middle, c.name?.family].filter(Boolean).join(" "),
  );
  const byPrimary = <T extends { isPrimary?: boolean | null }>(xs: T[] | undefined) =>
    [...(xs ?? [])].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
  const addr = byPrimary(c.postalAddresses)[0];
  const b = c.birthday;
  const mmdd = b?.month && b?.day ? `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}` : null;
  return {
    name: name || c.organization?.company?.trim() || "",
    emails: byPrimary(c.emails).map((e) => e.address?.trim() ?? "").filter(Boolean),
    phones: byPrimary(c.phones).map((p) => p.number?.trim() ?? "").filter(Boolean),
    address: addr
      ? [addr.street, addr.city, [addr.region, addr.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null
      : null,
    town: addr?.city?.trim() || null,
    notes: c.note?.trim() || null,
    birthday: mmdd ? parseBirthday(b?.year ? `${b.year}-${mmdd}` : `--${mmdd}`) : null,
    company: name && c.organization?.company ? c.organization.company.trim() : null,
  };
}

async function plugin() {
  return (await import("@capacitor-community/contacts")).Contacts;
}

/** Every contact on the phone. Throws if she declines access. */
export async function readNativeContacts(): Promise<ParsedContact[]> {
  const Contacts = await plugin();
  const perm = await Contacts.requestPermissions();
  if (perm.contacts !== "granted" && perm.contacts !== "limited") {
    throw new Error("Allow Aria to read your contacts in Settings → Aria → Contacts.");
  }
  const { contacts } = await Contacts.getContacts({ projection: PROJECTION });
  return contacts.map(fromNativeContact).filter((c) => c.name || c.emails.length || c.phones.length);
}

/** The iOS contact picker for one person (no address-book permission needed). Null if she cancels. */
export async function pickNativeContact(): Promise<ParsedContact | null> {
  const Contacts = await plugin();
  try {
    const { contact } = await Contacts.pickContact({ projection: PROJECTION });
    return contact ? fromNativeContact(contact) : null;
  } catch {
    return null;
  }
}
