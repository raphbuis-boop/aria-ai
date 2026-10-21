"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardPaste, FileUp, Search, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { fmtPhone } from "@/lib/utils";
import type { ContactGroup, ImportSource, ParsedContact, Table } from "@/lib/contacts/types";
import { parseCsv } from "@/lib/contacts/csv";
import { parseVcf } from "@/lib/contacts/vcard";
import { parsePastedText } from "@/lib/contacts/paste";
import { readXlsxFile } from "@/lib/contacts/xlsx";
import { autoMapColumns, CONTACT_FIELDS, CONTACT_FIELD_LABELS, tableToContacts, type ColumnMapping, type ContactField } from "@/lib/contacts/columns";
import { countsLine, planImport, type ExistingClient, type PlannedContact } from "@/lib/contacts/plan";
import { isNativeApp, readNativeContacts } from "@/lib/contacts/native";
import { ImportGroupPicker, ImportSummary, type ImportOutcome } from "./ImportSummary";

const MAX_ROWS = 2000;
/** A whole address book (Google, iPhone) starts unticked past this size — it includes the plumber. */
const PRESELECT_MAX = 100;
const SEND_CHUNK = 500;

/** Sources that open a screen of their own (the iPhone option reads straight away). */
type Method = "google" | "file" | "paste";
type Step =
  | { kind: "choose" }
  | { kind: "google" }
  | { kind: "file" }
  | { kind: "paste" }
  | { kind: "mapping"; table: Table; mapping: ColumnMapping[]; source: ImportSource; label: string }
  | { kind: "review"; contacts: ParsedContact[]; source: ImportSource; resourceNames?: string[] }
  | { kind: "done"; result: ImportOutcome };

/** Every existing client's emails/phones, for the preview (the server re-checks on import). */
async function loadExisting(): Promise<ExistingClient[]> {
  const supabase = createClient();
  const out: ExistingClient[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone, emails, phones")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as ExistingClient[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function MethodCard({ Icon, title, desc, onClick }: { Icon: typeof Users; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 text-left hover:bg-secondary/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="size-4 text-primary" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-body font-semibold text-foreground">{title}</span>
        <span className="block font-display text-caption text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

/**
 * Every way to bring people into Aria, one flow: pick a source, map columns
 * (spreadsheets), review "X new, Y already in Aria, Z skipped" with the group
 * (Sphere / Past client / Active lead), import. The iPhone option only shows
 * inside the iOS app. `returnTo` is the aria_return_to value for the Google
 * connect round-trip; `initialMethod` jumps straight to a source.
 */
export function ContactImporter({
  returnTo,
  initialMethod,
  onDone,
  onImported,
  doneLabel = "Continue",
}: {
  returnTo: "onboarding" | "import";
  initialMethod?: Method;
  onDone: (result: ImportOutcome) => void;
  onImported?: (result: ImportOutcome) => void;
  doneLabel?: string;
}) {
  const [step, setStep] = useState<Step>({ kind: initialMethod ?? "choose" });
  const [native, setNative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");

  useEffect(() => setNative(isNativeApp()), []);

  function toContacts(contacts: ParsedContact[], source: ImportSource, resourceNames?: string[]) {
    if (!contacts.length) {
      setError("No contacts found in that. Check it has names with phone numbers or emails.");
      return;
    }
    // Files and pasted lists are capped; whole address books are picked from, then sent in chunks.
    if (contacts.length > MAX_ROWS && (source === "file" || source === "paste")) {
      setError(`That's ${contacts.length} contacts — the limit is ${MAX_ROWS} per import. Split it and import in parts.`);
      return;
    }
    setError(null);
    setStep({ kind: "review", contacts, source, resourceNames });
  }

  function toTable(table: Table, source: ImportSource, label: string) {
    if (!table.headers.length || !table.rows.length) {
      setError("That file has no rows under the header row.");
      return;
    }
    setError(null);
    setStep({ kind: "mapping", table, mapping: autoMapColumns(table.headers), source, label });
  }

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".vcf") || /vcard/i.test(file.type)) {
        toContacts(parseVcf(await file.text()), "file");
      } else if (name.endsWith(".xlsx") || /spreadsheetml/.test(file.type)) {
        toTable(await readXlsxFile(file), "file", file.name);
      } else if (name.endsWith(".csv") || name.endsWith(".txt") || /csv|text\/plain/.test(file.type)) {
        toTable(parseCsv(await file.text()), "file", file.name);
      } else {
        setError("Use a .csv, .xlsx or .vcf file.");
      }
    } catch {
      setError("Couldn't read that file. If it's from Excel, save it as .xlsx or .csv and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onPaste() {
    const r = parsePastedText(pasted);
    if (r.kind === "table") toTable(r.table, "paste", "Pasted list");
    else toContacts(r.contacts, "paste");
  }

  async function fromPhone() {
    setBusy(true);
    setError(null);
    try {
      toContacts(await readNativeContacts(), "phone");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read your contacts.");
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <button type="button" onClick={() => { setError(null); setStep({ kind: "choose" }); }} className="mb-4 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-muted-foreground">
      <ArrowLeft className="size-3.5" /> All import options
    </button>
  );
  const errorLine = error ? <p role="alert" className="mt-3 font-display text-caption text-danger">{error}</p> : null;

  if (step.kind === "done") {
    return (
      <div>
        <ImportSummary result={step.result} />
        <Button onClick={() => onDone(step.result)} className="mt-6 h-12 w-full rounded-xl text-body-lg font-semibold">
          {doneLabel}
        </Button>
      </div>
    );
  }

  if (step.kind === "choose") {
    return (
      <div className="space-y-2.5">
        <MethodCard Icon={Users} title="Google Contacts" desc="Every email and phone number for each person." onClick={() => setStep({ kind: "google" })} />
        <MethodCard Icon={FileUp} title="Upload a file" desc="CSV or Excel from your old CRM, or a .vcf from iPhone / iCloud." onClick={() => setStep({ kind: "file" })} />
        <MethodCard Icon={ClipboardPaste} title="Paste a list" desc="One person per line, or copied straight from a spreadsheet." onClick={() => setStep({ kind: "paste" })} />
        {native ? (
          <MethodCard Icon={Smartphone} title="From this iPhone" desc="Pick people from your phone's contacts." onClick={() => void fromPhone()} />
        ) : null}
        {busy ? <p className="font-display text-caption text-muted-foreground">Reading your contacts…</p> : null}
        {errorLine}
      </div>
    );
  }

  if (step.kind === "google") {
    return (
      <div>
        {back}
        <GoogleSource returnTo={returnTo} onContacts={(contacts, ids) => toContacts(contacts, "google", ids)} />
        {errorLine}
      </div>
    );
  }

  if (step.kind === "file") {
    return (
      <div>
        {back}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border-[1.5px] border-dashed border-input px-6 py-12 text-center hover:bg-secondary/40"
        >
          <FileUp className="mx-auto size-6 text-primary" />
          <p className="mt-3 font-display text-body font-semibold text-foreground">{busy ? "Reading…" : "Choose a file"}</p>
          <p className="mt-1 font-display text-caption text-muted-foreground">.csv, .xlsx or .vcf (iPhone / iCloud export) · up to {MAX_ROWS.toLocaleString()} people</p>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.vcf,.txt,text/csv,text/vcard,text/x-vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onFile(f);
          }}
        />
        <p className="mt-3 font-display text-caption text-muted-foreground">
          Column names don&apos;t need to match — Aria maps First/Last/Full name, every Email and Phone column, Address, Notes, Birthday and more, and you can fix any of it next.
        </p>
        {errorLine}
      </div>
    );
  }

  if (step.kind === "paste") {
    return (
      <div>
        {back}
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={9}
          placeholder={"Dana Mockley, 201-555-0180, dana@example.com\nLee Fakeworth <lee@example.org>\n…or paste rows copied from a spreadsheet"}
          aria-label="Paste contacts"
          className="w-full resize-y rounded-xl border border-input bg-secondary px-4 py-3 font-display text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <Button onClick={onPaste} disabled={!pasted.trim()} className="mt-3 h-12 w-full rounded-xl text-body-lg font-semibold">
          Continue
        </Button>
        {errorLine}
      </div>
    );
  }

  if (step.kind === "mapping") {
    return (
      <MappingStep
        step={step}
        onBack={() => setStep({ kind: step.source === "paste" ? "paste" : "file" })}
        onContinue={(mapping) => toContacts(tableToContacts(step.table, mapping), step.source)}
        error={errorLine}
      />
    );
  }

  return (
    <ReviewStep
      step={step}
      onBack={() => setStep({ kind: "choose" })}
      onImported={(result) => {
        onImported?.(result);
        setStep({ kind: "done", result });
      }}
    />
  );
}

// ── Google ───────────────────────────────────────────────────────────────────

type GoogleListing =
  | { status: "ok"; contacts: (ParsedContact & { resourceName: string })[]; truncated: boolean }
  | { status: "not_connected" }
  | { status: "needs_scope" }
  | { status: "error"; error: string };

function GoogleSource({ returnTo, onContacts }: { returnTo: string; onContacts: (c: ParsedContact[], ids: string[]) => void }) {
  const [listing, setListing] = useState<GoogleListing | null>(null);
  const onContactsRef = useRef(onContacts);
  onContactsRef.current = onContacts;

  useEffect(() => {
    let live = true;
    void fetch("/api/contacts/google")
      .then(async (r) => (await r.json().catch(() => ({ status: "error", error: "Couldn't read your Google Contacts." }))) as GoogleListing)
      .then((data) => {
        if (!live) return;
        setListing(data);
        if (data.status === "ok") onContactsRef.current(data.contacts, data.contacts.map((c) => c.resourceName));
      })
      .catch(() => live && setListing({ status: "error", error: "Couldn't reach Aria. Check your connection." }));
    return () => {
      live = false;
    };
  }, []);

  function connect() {
    document.cookie = `aria_return_to=${returnTo}; path=/; max-age=600; SameSite=Lax`;
    window.location.href = "/api/auth/google/connect";
  }

  if (!listing || listing.status === "ok") {
    return (
      <SkeletonRegion label="Loading your Google Contacts…">
        <Skeleton className="mb-3 h-12 w-full rounded-xl" />
        <SkeletonRows count={5} />
      </SkeletonRegion>
    );
  }
  const copy =
    listing.status === "not_connected"
      ? { title: "Connect Google first", body: "Aria reads your contacts (never changes them) so you can pick who to bring in.", cta: "Connect Google" }
      : listing.status === "needs_scope"
        ? { title: "Allow access to contacts", body: "Your Google connection doesn't include contacts yet. Reconnect and tick the contacts permission.", cta: "Reconnect Google" }
        : { title: "Couldn't load contacts", body: listing.error, cta: null };
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-6 text-center">
      <p className="font-display text-body-lg font-semibold text-foreground">{copy.title}</p>
      <p className="mx-auto mt-1 max-w-sm font-display text-body text-muted-foreground">{copy.body}</p>
      {copy.cta ? (
        <Button onClick={connect} className="mt-4 rounded-full px-5">
          {copy.cta}
        </Button>
      ) : null}
    </div>
  );
}

// ── Column mapping ───────────────────────────────────────────────────────────

function MappingStep({
  step,
  onBack,
  onContinue,
  error,
}: {
  step: Extract<Step, { kind: "mapping" }>;
  onBack: () => void;
  onContinue: (mapping: ColumnMapping[]) => void;
  error: React.ReactNode;
}) {
  const [mapping, setMapping] = useState(step.mapping);
  const sample = (i: number) => step.table.rows.find((r) => r[i]?.trim())?.[i]?.trim() ?? "";
  const mapsName = mapping.some((m) => m.field === "name" || m.field === "first_name" || m.field === "last_name");
  const mapsContact = mapping.some((m) => m.field === "email" || m.field === "phone");

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Back
      </button>
      <p className="font-display text-body font-semibold text-foreground">Match the columns</p>
      <p className="mb-3 font-display text-caption text-muted-foreground">
        {step.label} · {step.table.rows.length} row{step.table.rows.length === 1 ? "" : "s"}. Aria matched what it recognized; change anything that&apos;s off.
      </p>
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
        {step.table.headers.map((h, i) => {
          const m = mapping[i];
          return (
            <div key={`${h}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span className={`size-1.5 shrink-0 rounded-full ${m.field === "skip" ? "bg-border" : m.confident ? "bg-primary" : "bg-warm"}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-display text-caption font-semibold ${m.field === "skip" ? "text-muted-foreground" : "text-foreground"}`}>{h || `Column ${i + 1}`}</span>
                <span className="block truncate font-display text-[11px] text-muted-foreground">{sample(i) || "—"}</span>
              </span>
              <select
                aria-label={`Field for ${h || `column ${i + 1}`}`}
                value={m.field}
                onChange={(e) => {
                  const next = [...mapping];
                  next[i] = { field: e.target.value as ContactField, confident: true };
                  setMapping(next);
                }}
                className="max-w-[46%] shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 font-display text-caption text-foreground"
              >
                {CONTACT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {CONTACT_FIELD_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {!mapsName || !mapsContact ? (
        <p className="mt-3 font-display text-caption text-warm">
          {!mapsName ? "Pick the name column(s). " : ""}
          {!mapsContact ? "Pick at least one email or phone column — people without either are skipped." : ""}
        </p>
      ) : null}
      <Button onClick={() => onContinue(mapping)} className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold">
        Continue
      </Button>
      {error}
    </div>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────

function ReviewStep({
  step,
  onBack,
  onImported,
}: {
  step: Extract<Step, { kind: "review" }>;
  onBack: () => void;
  onImported: (r: ImportOutcome) => void;
}) {
  const [existing, setExisting] = useState<ExistingClient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [group, setGroup] = useState<ContactGroup>("sphere");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadExisting()
      .then(setExisting)
      .catch(() => setLoadError("Couldn't check your existing clients. Try again."));
  }, []);

  const plan = useMemo(() => (existing ? planImport(existing, step.contacts) : null), [existing, step.contacts]);
  const newItems = useMemo(() => plan?.items.filter((i) => i.status === "new") ?? [], [plan]);
  const otherItems = useMemo(() => plan?.items.filter((i) => i.status === "existing" || i.status === "no_contact") ?? [], [plan]);

  // A list she put together is all wanted; a whole address book starts empty past PRESELECT_MAX.
  useEffect(() => {
    if (!plan) return;
    const wholeBook = step.source === "google" || step.source === "phone";
    setSelected(new Set(!wholeBook || newItems.length <= PRESELECT_MAX ? newItems.map((i) => i.index) : []));
  }, [plan, newItems, step.source]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return newItems;
    return newItems.filter((i) => [i.contact.name, ...i.contact.emails, ...i.contact.phones, i.contact.town ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [newItems, query]);
  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.index));

  async function runImport() {
    setImporting(true);
    setError(null);
    try {
      const chosen = newItems.filter((i) => selected.has(i.index));
      const total: ImportOutcome = { inserted: 0, existing: 0, noContact: 0, duplicates: 0, skipped: [], warnings: [] };
      const add = (r: ImportOutcome) => {
        total.inserted += r.inserted;
        total.existing += r.existing;
        total.noContact += r.noContact;
        total.duplicates += r.duplicates;
        total.skipped.push(...r.skipped);
        total.warnings.push(...r.warnings);
      };
      if (step.source === "google") {
        const res = await fetch("/api/contacts/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceNames: chosen.map((i) => step.resourceNames?.[i.index]).filter(Boolean), group }),
        });
        const json = (await res.json().catch(() => ({}))) as ImportOutcome & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Import failed. Try again.");
        add(json);
      } else {
        // Send the cleaned-up contacts (duplicates in the list already merged); the server
        // normalizes and de-dupes again against the database, so report dropped values here.
        const rows = chosen.map((i) => ({ ...i.contact, invalid: undefined }));
        for (const i of chosen) {
          for (const bad of i.contact.invalid) {
            total.warnings.push({ row: i.index + 1, name: i.contact.name, reason: `"${bad}" isn't a full phone number or email — left out` });
          }
        }
        for (let i = 0; i < rows.length; i += SEND_CHUNK) {
          const res = await fetch("/api/clients/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contacts: rows.slice(i, i + SEND_CHUNK), group, source: step.source }),
          });
          const json = (await res.json().catch(() => ({}))) as ImportOutcome & { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Import failed. Try again.");
          add(json);
        }
      }
      // Count what wasn't sent, so the summary matches the preview.
      total.existing += plan?.counts.existing ?? 0;
      total.noContact += plan?.counts.noContact ?? 0;
      total.duplicates += plan?.counts.duplicate ?? 0;
      for (const i of otherItems) {
        total.skipped.push({ row: i.index + 1, name: i.contact.name, reason: i.status === "existing" ? `Already in Aria${i.existingName && i.existingName !== i.contact.name ? ` as ${i.existingName}` : ""}` : "No phone or email" });
      }
      onImported(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Try again.");
    } finally {
      setImporting(false);
    }
  }

  if (loadError) return <p role="alert" className="font-display text-body text-danger">{loadError}</p>;
  if (!plan) {
    return (
      <SkeletonRegion label="Checking against your clients…">
        <Skeleton className="mb-3 h-12 w-full rounded-xl" />
        <SkeletonRows count={5} />
      </SkeletonRegion>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Start over
      </button>

      <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
        <p className="font-display text-body font-semibold text-foreground">{countsLine(plan.counts)}</p>
        <p className="font-display text-caption text-muted-foreground">
          People already in Aria match on any email or phone and are left as they are.
        </p>
      </div>

      <div className="mb-5">
        <ImportGroupPicker value={group} onChange={setGroup} />
      </div>

      {newItems.length ? (
        <>
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${newItems.length} new people`}
              aria-label="Search new contacts"
              data-focus-parent
              className="min-w-0 flex-1 bg-transparent font-display text-body text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-caption text-muted-foreground">
              {selected.size === 0 && newItems.length > PRESELECT_MAX ? "Tick the people you work with" : `${selected.size} selected`}
            </p>
            <button
              type="button"
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const i of shown) {
                    if (allShownSelected) next.delete(i.index);
                    else next.add(i.index);
                  }
                  return next;
                })
              }
              className="font-display text-caption font-semibold text-primary"
            >
              {allShownSelected ? "Clear" : "Select all"}
              {query ? " shown" : ""}
            </button>
          </div>
          <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
            {shown.map((i) => (
              <ContactRow
                key={i.index}
                item={i}
                checked={selected.has(i.index)}
                onToggle={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(i.index)) next.delete(i.index);
                    else next.add(i.index);
                    return next;
                  })
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center font-display text-body text-muted-foreground">
          Everyone here is already in Aria or has no phone or email.
        </p>
      )}

      {otherItems.length ? (
        <details className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-display text-caption font-semibold text-foreground">
            Not importing · {otherItems.length}
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {otherItems.map((i) => (
              <li key={i.index} className="font-display text-caption text-muted-foreground">
                {i.contact.name || "Unnamed"} — {i.status === "existing" ? `already in Aria${i.existingName && i.existingName !== i.contact.name ? ` as ${i.existingName}` : ""}` : "no phone or email"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {error ? <p role="alert" className="mt-3 font-display text-caption text-danger">{error}</p> : null}
      <Button onClick={() => void runImport()} disabled={importing || selected.size === 0} className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold">
        {importing ? "Importing…" : `Import ${selected.size} contact${selected.size === 1 ? "" : "s"}`}
      </Button>
      <p className="mt-2 text-center font-display text-caption text-muted-foreground">
        Imported people are never texted automatically.
      </p>
    </div>
  );
}

function ContactRow({ item, checked, onToggle }: { item: PlannedContact; checked: boolean; onToggle: () => void }) {
  const c = item.contact;
  const detail = [c.phones[0] ? fmtPhone(c.phones[0]) : null, c.emails[0], c.town].filter(Boolean).join(" · ");
  const extra = c.emails.length + c.phones.length - (c.emails[0] ? 1 : 0) - (c.phones[0] ? 1 : 0);
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 shrink-0 accent-[var(--primary)]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-body font-semibold text-foreground">{c.name}</span>
          <span className="block truncate font-display text-caption text-muted-foreground">
            {detail}
            {extra > 0 ? ` · +${extra} more` : ""}
          </span>
        </span>
      </label>
    </li>
  );
}
