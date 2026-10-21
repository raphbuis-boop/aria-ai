"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import type { ContactGroup } from "@/lib/contacts/types";

export type ImportNote = { row: number; name: string; reason: string };
export type ImportOutcome = {
  inserted: number;
  existing: number;
  noContact: number;
  duplicates: number;
  skipped: ImportNote[];
  warnings: ImportNote[];
};

/** What happened: imported count, then expandable skipped / warning lists. */
export function ImportSummary({ result }: { result: ImportOutcome }) {
  return (
    <div className="text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle className="size-6 text-primary" />
      </span>
      <p className="font-heading text-[22px] text-foreground">
        {result.inserted} client{result.inserted === 1 ? "" : "s"} imported
      </p>
      <p className="mt-1 font-display text-caption text-muted-foreground">
        {result.existing} already in Aria · {result.noContact} skipped (no phone or email)
        {result.duplicates ? ` · ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} merged` : ""}
      </p>
      <div className="mt-4 space-y-2 text-left">
        <NoteList title="Not imported" notes={result.skipped} />
        <NoteList title="Imported with a value left out" notes={result.warnings} />
      </div>
    </div>
  );
}

function NoteList({ title, notes }: { title: string; notes: ImportNote[] }) {
  const [open, setOpen] = useState(false);
  if (!notes.length) return null;
  const shown = open ? notes : notes.slice(0, 3);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-display text-caption font-semibold text-foreground">
        {title} · {notes.length}
      </p>
      <ul className="mt-1.5 space-y-1">
        {shown.map((n, i) => (
          <li key={`${n.row}-${i}`} className="font-display text-caption text-muted-foreground">
            {n.name || `Row ${n.row}`} — {n.reason}
          </li>
        ))}
      </ul>
      {notes.length > 3 ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 font-display text-caption font-semibold text-primary">
          {open ? "Show less" : `Show all ${notes.length}`}
        </button>
      ) : null}
    </div>
  );
}

const GROUP_OPTIONS: { v: ContactGroup; title: string; desc: string }[] = [
  { v: "sphere", title: "Sphere", desc: "Friends, family and people you know. Aria suggests regular check-ins." },
  { v: "past_client", title: "Past client", desc: "People you've closed with. Check-ins, anniversaries, referrals." },
  { v: "lead", title: "Active lead", desc: "People looking to buy, sell or rent now." },
];

/** Asked once per import: what these people are to her. Defaults to Sphere. */
export function ImportGroupPicker({ value, onChange }: { value: ContactGroup; onChange: (v: ContactGroup) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-display text-body font-semibold text-foreground">Who are these people?</legend>
      {GROUP_OPTIONS.map((o) => (
        <label
          key={o.v}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${value === o.v ? "border-primary bg-primary/5" : "border-input bg-card"}`}
        >
          <input type="radio" name="import-group" value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} className="mt-1 accent-[var(--primary)]" />
          <span>
            <span className="block font-display text-body font-semibold text-foreground">{o.title}</span>
            <span className="block font-display text-caption text-muted-foreground">{o.desc}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
