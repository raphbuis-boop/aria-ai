"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

export type ImportNote = { row: number; name: string; reason: string };
export type ImportOutcome = { inserted: number; skipped: ImportNote[]; warnings: ImportNote[] };

/** What happened to every row: imported count, then expandable skipped / warning lists. */
export function ImportSummary({ result, rowLabel = "Row" }: { result: ImportOutcome; rowLabel?: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle className="size-6 text-primary" />
      </span>
      <p className="font-heading text-[22px] text-foreground">
        {result.inserted} client{result.inserted === 1 ? "" : "s"} imported
      </p>
      <div className="mt-4 space-y-2 text-left">
        <NoteList title="Not imported" notes={result.skipped} rowLabel={rowLabel} />
        <NoteList title="Imported with a field left blank" notes={result.warnings} rowLabel={rowLabel} />
      </div>
    </div>
  );
}

function NoteList({ title, notes, rowLabel }: { title: string; notes: ImportNote[]; rowLabel: string }) {
  const [open, setOpen] = useState(false);
  if (!notes.length) return null;
  const shown = open ? notes : notes.slice(0, 3);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-display text-caption font-semibold text-foreground">
        {title} · {notes.length}
      </p>
      <ul className="mt-1.5 space-y-1">
        {shown.map((n) => (
          <li key={`${n.row}-${n.reason}`} className="font-display text-caption text-muted-foreground">
            {rowLabel} {n.row}
            {n.name ? ` · ${n.name}` : ""} — {n.reason}
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

/** Asked once per import: decides whether people start as new leads or as known contacts. */
export function ImportGroupPicker({ value, onChange }: { value: "leads" | "sphere"; onChange: (v: "leads" | "sphere") => void }) {
  const options = [
    { v: "sphere" as const, title: "Past clients & people I know", desc: "Aria suggests regular check-ins." },
    { v: "leads" as const, title: "New leads", desc: "People actively looking to buy or sell." },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-display text-body font-semibold text-foreground">Who are these people?</legend>
      {options.map((o) => (
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
