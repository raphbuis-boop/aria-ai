// Parser tests for contact imports: CSV (Google, Outlook/semicolon), vCard
// (iPhone/iCloud 3.0, Android 2.1 quoted-printable), XLSX, pasted text, and
// the de-dupe planner. Fixtures in tests/fixtures/contacts use fake people.
// Run: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readSheet } from "read-excel-file/node";
import { parseCsv, parseCsvRows } from "@/lib/contacts/csv";
import { autoMapColumns, guessField, tableToContacts } from "@/lib/contacts/columns";
import { parseVcf } from "@/lib/contacts/vcard";
import { parsePastedText } from "@/lib/contacts/paste";
import { sheetToTable } from "@/lib/contacts/xlsx";
import { birthdayForDb, parseBirthday } from "@/lib/contacts/normalize";
import { countsLine, planImport } from "@/lib/contacts/plan";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", "contacts", name));
const text = (name: string) => fixture(name).toString("utf8");

test("CSV: quoted commas, quotes, multi-line cells, CRLF and BOM", () => {
  const rows = parseCsvRows('﻿Name,Notes\r\n"Doe, Jane","She said ""hi""\nsecond line"\r\n\r\nSolo,\r\n');
  assert.deepEqual(rows, [
    ["Name", "Notes"],
    ["Doe, Jane", 'She said "hi"\nsecond line'],
    ["Solo", ""],
  ]);
});

test("CSV: Google Contacts export maps every email and phone", () => {
  const table = parseCsv(text("google.csv"));
  const mapping = autoMapColumns(table.headers);
  const field = (h: string) => mapping[table.headers.indexOf(h)].field;
  assert.equal(field("First Name"), "first_name");
  assert.equal(field("Last Name"), "last_name");
  assert.equal(field("Name Prefix"), "skip");
  assert.equal(field("Phonetic First Name"), "skip");
  assert.equal(field("E-mail 1 - Label"), "skip");
  assert.equal(field("E-mail 1 - Value"), "email");
  assert.equal(field("E-mail 2 - Value"), "email");
  assert.equal(field("Phone 1 - Value"), "phone");
  assert.equal(field("Address 1 - Formatted"), "address");
  assert.equal(field("Address 1 - City"), "city");
  assert.equal(field("Organization Name"), "company");

  const contacts = tableToContacts(table, mapping);
  assert.equal(contacts.length, 4);
  const avery = contacts[0];
  assert.equal(avery.name, "Avery Q Fakename");
  assert.deepEqual(avery.emails, ["Avery.Fakename@Example.com", "avery@testco.example.org"]);
  assert.deepEqual(avery.phones, ["(201) 555-0134", "201.555.0135", "201-555-0136"]);
  assert.equal(avery.address, "12 Sample Lane, Testville, NJ 07000");
  assert.equal(avery.town, "Testville");
  assert.equal(avery.notes, "Met at open house, wants 4BR");
  assert.equal(avery.birthday, "1985-07-04");
  assert.equal(avery.company, "Testco Holdings");

  assert.equal(contacts[1].name, "Jordan Sample");
  assert.equal(contacts[1].birthday, "--09-15");
  assert.deepEqual(contacts[2].emails, []);
  // A company-only row still comes through (named after the email/phone by the planner).
  assert.deepEqual(contacts[3].emails, ["closings@acmetitle.example.com"]);
});

test("CSV: semicolon-delimited Outlook export with CRLF", () => {
  const table = parseCsv(text("outlook-semicolon.csv"));
  assert.equal(table.headers.length, 14);
  const mapping = autoMapColumns(table.headers);
  assert.equal(mapping[table.headers.indexOf("Business Fax")].field, "skip");
  const [casey, morgan] = tableToContacts(table, mapping);
  assert.equal(casey.name, "Casey Example");
  assert.deepEqual(casey.phones, ["201-555-0101"]);
  assert.equal(casey.birthday, "1985-07-04");
  assert.equal(casey.address, "9 Demo Road, Fauxtown, NJ 07001");
  assert.equal(casey.notes, "Prefers text; evenings");
  assert.deepEqual(morgan.emails, ["morgan.t@example.net"]);
  assert.deepEqual(morgan.phones, ["(973) 555-0110"]);
});

test("vCard: iPhone/iCloud 3.0 export", () => {
  const contacts = parseVcf(text("icloud.vcf"));
  assert.equal(contacts.length, 4);
  const [taylor, inspector, sam, taylorAgain] = contacts;
  assert.equal(taylor.name, "Taylor Fakename");
  // type=pref first, then file order; "item1." groups ignored.
  assert.deepEqual(taylor.emails, ["Taylor@Lending.Example.org", "taylor.home@example.com"]);
  assert.deepEqual(taylor.phones, ["(201) 555-0140", "201-555-0141"]);
  assert.equal(taylor.address, "45 Example Ave, Apt 2, Testville, NJ 07002, United States");
  assert.equal(taylor.town, "Testville");
  assert.equal(taylor.notes, "Buying in spring, first-time buyer\nLikes older homes");
  assert.equal(taylor.birthday, "--07-04"); // X-APPLE-OMIT-YEAR
  assert.equal(taylor.company, "Sample Lending");

  assert.equal(inspector.name, "Placeholder Inspections");
  assert.deepEqual(inspector.phones, ["+1 (862) 555-0150"]);
  assert.equal(sam.name, "Sam Nobody");
  assert.deepEqual(sam.emails, []);
  assert.deepEqual(taylorAgain.phones, ["2015550142"]);
});

test("vCard: Android 2.1 quoted-printable with soft line breaks", () => {
  const [zoe] = parseVcf(text("android-2.1.vcf"));
  assert.equal(zoe.name, "Zoë Fakename");
  // TEL;WORK;PREF comes first.
  assert.deepEqual(zoe.phones, ["973-555-0161", "973-555-0160"]);
  assert.deepEqual(zoe.emails, ["zoe@example.com"]);
  assert.equal(zoe.address, "1 Café Street, Montclair, NJ 07042");
  assert.equal(zoe.birthday, "1990-02-15");
});

test("XLSX: numeric phones and date cells", async () => {
  const sheet = await readSheet(fixture("contacts.xlsx"));
  const table = sheetToTable(sheet as never);
  assert.deepEqual(table.headers, ["Full Name", "Email 1", "Email 2", "Cell", "Birthday", "Notes"]);
  const contacts = tableToContacts(table, autoMapColumns(table.headers));
  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].name, "Morgan Testcase");
  assert.deepEqual(contacts[0].phones, ["2015550170"]);
  assert.equal(contacts[0].birthday, "1989-07-04");
  assert.deepEqual(contacts[1].emails, ["quinn@example.org"]);
  assert.deepEqual(contacts[1].phones, ["201-555-0171"]);
});

test("Paste: one contact per line, any order", () => {
  const r = parsePastedText(
    [
      "Dana Mockley, 201-555-0180, dana@example.com",
      "Lee Fakeworth <lee@example.org>",
      "(973) 555-0181 Pat Sampleton",
      "cell: +1 201 555 0182 - Robin Testa",
      "",
    ].join("\n"),
  );
  assert.equal(r.kind, "contacts");
  if (r.kind !== "contacts") return;
  assert.deepEqual(
    r.contacts.map((c) => [c.name, c.emails, c.phones]),
    [
      ["Dana Mockley", ["dana@example.com"], ["201-555-0180"]],
      ["Lee Fakeworth", ["lee@example.org"], []],
      ["Pat Sampleton", [], ["(973) 555-0181"]],
      ["Robin Testa", [], ["+1 201 555 0182"]],
    ],
  );
});

test("Paste: copied spreadsheet with a header row becomes a table", () => {
  const r = parsePastedText("Name\tEmail\tPhone\nDana Mockley\tdana@example.com\t201-555-0180\n");
  assert.equal(r.kind, "table");
  if (r.kind !== "table") return;
  const [dana] = tableToContacts(r.table, autoMapColumns(r.table.headers));
  assert.deepEqual([dana.name, dana.emails, dana.phones], ["Dana Mockley", ["dana@example.com"], ["201-555-0180"]]);

  // Without a header row the cells are read line by line.
  const noHeader = parsePastedText("Dana Mockley\tdana@example.com\t201-555-0180");
  assert.equal(noHeader.kind, "contacts");
});

test("Header guesses", () => {
  assert.equal(guessField("Mobile Phone").field, "phone");
  assert.equal(guessField("Assistant's Phone").field, "skip");
  assert.equal(guessField("Email 2").field, "email");
  assert.equal(guessField("DOB").field, "birthday");
  assert.equal(guessField("Price Max").field, "budget_max");
  assert.equal(guessField("Whatever").field, "skip");
});

test("Birthdays", () => {
  assert.equal(parseBirthday("1985-07-04"), "1985-07-04");
  assert.equal(parseBirthday("19850704"), "1985-07-04");
  assert.equal(parseBirthday("--0704"), "--07-04");
  assert.equal(parseBirthday("7/4"), "--07-04");
  assert.equal(parseBirthday("July 4, 1985"), "1985-07-04");
  assert.equal(parseBirthday("02/30/1990"), null);
  assert.equal(parseBirthday(32693), "1989-07-04"); // Excel serial
  assert.equal(birthdayForDb("--02-29"), "1904-02-29");
});

test("Planner: de-dupes on any email or phone, merges repeats, skips the unreachable", () => {
  const existing = [
    { id: "c1", name: "Taylor F.", email: null, phone: null, emails: ["taylor.home@example.com"], phones: [] },
    { id: "c2", name: "Old Number", email: null, phone: "(862) 555-0150", emails: [], phones: [] },
  ];
  const contacts = [
    ...parseVcf(text("icloud.vcf")),
    { name: "New Person", emails: ["NEW@example.com"], phones: ["201 555 0190"] },
    { name: "New Person (work)", emails: ["new.work@example.com"], phones: ["2015550190"] },
    { name: "", emails: ["nameless@example.com"], phones: ["not a number"] },
  ];
  const { items, counts } = planImport(existing, contacts);
  assert.deepEqual(
    items.map((i) => i.status),
    ["existing", "existing", "no_contact", "existing", "new", "duplicate", "new"],
  );
  assert.equal(items[0].existingName, "Taylor F."); // matched on a secondary email
  assert.equal(items[1].existingId, "c2"); // phone stored in another format
  const merged = items[4].contact;
  assert.deepEqual(merged.emails, ["new@example.com", "new.work@example.com"]);
  assert.deepEqual(merged.phones, ["+12015550190"]);
  assert.equal(items[6].contact.name, "nameless@example.com");
  assert.deepEqual(items[6].contact.invalid, ["not a number"]);
  assert.deepEqual(counts, { new: 2, existing: 3, noContact: 1, duplicate: 1 });
  assert.equal(countsLine(counts), "2 new, 3 already in Aria, 1 skipped (no phone or email), 1 duplicate merged");
});
