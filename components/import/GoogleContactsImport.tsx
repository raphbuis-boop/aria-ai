"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/Skeleton";
import { fmtPhone } from "@/lib/utils";
import { ImportGroupPicker, ImportSummary, type ImportOutcome } from "./ImportSummary";

type Contact = {
  resourceName: string;
  name: string;
  email: string | null;
  phone: string | null;
  rawPhone: string | null;
  town: string | null;
  alreadyClient: boolean;
};

type Listing =
  | { status: "ok"; contacts: Contact[]; truncated: boolean }
  | { status: "not_connected" }
  | { status: "needs_scope" }
  | { status: "error"; error: string };

/**
 * Pick people from Google Contacts and import them as clients. Everyone with
 * a phone or email is pre-selected except people already in Aria.
 * `returnTo` is the aria_return_to value for the Google connect round-trip.
 */
export function GoogleContactsImport({
  returnTo,
  onDone,
  doneLabel = "Continue",
}: {
  returnTo: "onboarding" | "import";
  onDone: (result: ImportOutcome) => void;
  doneLabel?: string;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"leads" | "sphere">("sphere");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/contacts/google")
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as Listing & { error?: string };
        if (!r.ok) return setListing({ status: "error", error: data.error ?? "Couldn't read your Google Contacts." });
        setListing(data);
        if (data.status === "ok") {
          setSelected(new Set(data.contacts.filter((c) => !c.alreadyClient && (c.phone || c.email)).map((c) => c.resourceName)));
        }
      })
      .catch(() => setListing({ status: "error", error: "Couldn't reach Aria. Check your connection." }));
  }, []);

  const contacts = useMemo(() => (listing?.status === "ok" ? listing.contacts : []), [listing]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? contacts.filter((c) => [c.name, c.email, c.phone, c.town].some((v) => v?.toLowerCase().includes(q))) : contacts;
  }, [contacts, query]);
  const selectable = shown.filter((c) => !c.alreadyClient);
  const allShownSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.resourceName));

  function connect() {
    document.cookie = `aria_return_to=${returnTo}; path=/; max-age=600; SameSite=Lax`;
    window.location.href = "/api/auth/google/connect";
  }

  function toggle(rn: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rn)) next.delete(rn);
      else next.add(rn);
      return next;
    });
  }

  async function runImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceNames: Array.from(selected), group }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportOutcome & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed. Try again.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Try again.");
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <div>
        <ImportSummary result={result} rowLabel="Contact" />
        <Button onClick={() => onDone(result)} className="mt-6 h-12 w-full rounded-xl text-body-lg font-semibold">
          {doneLabel}
        </Button>
      </div>
    );
  }

  if (!listing) {
    return (
      <SkeletonRegion label="Loading your Google Contacts…">
        <Skeleton className="mb-3 h-12 w-full rounded-xl" />
        <SkeletonRows count={5} />
      </SkeletonRegion>
    );
  }

  if (listing.status !== "ok") {
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

  if (!contacts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center font-display text-body text-muted-foreground">
        No contacts in your Google account. Try a CSV export instead.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <ImportGroupPicker value={group} onChange={setGroup} />
      </div>

      <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${contacts.length} contacts`}
          aria-label="Search contacts"
          data-focus-parent
          className="min-w-0 flex-1 bg-transparent font-display text-body text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-caption text-muted-foreground">
          {selected.size} selected{listing.truncated ? " · showing your first 2,000" : ""}
        </p>
        <button
          type="button"
          onClick={() =>
            setSelected((prev) => {
              const next = new Set(prev);
              for (const c of selectable) {
                if (allShownSelected) next.delete(c.resourceName);
                else next.add(c.resourceName);
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

      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
        {shown.map((c) => (
          <li key={c.resourceName}>
            <label className={`flex items-center gap-3 px-4 py-3 ${c.alreadyClient ? "opacity-60" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={selected.has(c.resourceName)}
                disabled={c.alreadyClient}
                onChange={() => toggle(c.resourceName)}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-body font-semibold text-foreground">{c.name}</span>
                <span className="block truncate font-display text-caption text-muted-foreground">
                  {c.alreadyClient
                    ? "Already a client"
                    : [c.phone ? fmtPhone(c.phone) : c.rawPhone, c.email, c.town].filter(Boolean).join(" · ") || "No phone or email"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 font-display text-caption text-danger">{error}</p> : null}
      <Button
        onClick={() => void runImport()}
        disabled={importing || selected.size === 0}
        className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold"
      >
        {importing ? "Importing…" : `Import ${selected.size} contact${selected.size === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
