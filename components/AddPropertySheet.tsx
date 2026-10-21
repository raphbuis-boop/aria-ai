"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const STATUS_OPTIONS = [
  ["available", "Available"],
  ["pending", "Pending"],
  ["sold", "Sold"],
  ["off_market", "Off market"],
] as const;

const FIELD =
  "w-full rounded-xl border border-input bg-secondary px-4 py-3 font-display text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

type Extracted = {
  address: string | null;
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photo: string | null;
  mlsNumber: string | null;
  sourceUrl: string | null;
};

const EMPTY_FORM = {
  address: "", town: "", price: "", beds: "", baths: "", sqft: "", mlsNumber: "",
  status: "available", photo: "", description: "", sourceUrl: "",
};

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/**
 * Adds a home to the agent's own `properties` — the inventory Aria matches
 * against clients and recommends from. She can paste a Zillow / Realtor.com /
 * NJMLS link or an MLS # to pre-fill the form, then checks it and saves; the
 * server runs client matching on save.
 */
export function AddPropertySheet({ onClose, startWithLink = false }: { onClose: () => void; startWithLink?: boolean }) {
  const router = useRouter();
  const linkRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(EMPTY_FORM);

  useEffect(() => {
    if (startWithLink) linkRef.current?.focus();
  }, [startWithLink]);

  async function lookUp() {
    if (!link.trim() || looking) return;
    setLooking(true);
    setNote(null);
    try {
      const res = await fetch("/api/properties/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: link }),
      });
      const json = (await res.json().catch(() => ({}))) as { property?: Extracted; note?: string | null; error?: string };
      if (!res.ok || !json.property) throw new Error(json.error ?? "Couldn't read that link");
      const p = json.property;
      // Fill what was found; keep anything she already typed for the rest.
      setF((prev) => ({
        ...prev,
        address: str(p.address) || prev.address,
        town: str(p.town) || prev.town,
        price: str(p.price) || prev.price,
        beds: str(p.beds) || prev.beds,
        baths: str(p.baths) || prev.baths,
        sqft: str(p.sqft) || prev.sqft,
        mlsNumber: str(p.mlsNumber) || prev.mlsNumber,
        photo: str(p.photo) || prev.photo,
        sourceUrl: str(p.sourceUrl) || prev.sourceUrl,
      }));
      setNote(json.note ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that link");
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    if (!f.address.trim() || !f.town.trim()) {
      toast.error("Address and town are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = (await res.json().catch(() => ({}))) as { propertyId?: string; matched?: number; error?: string };
      if (!res.ok || !json.propertyId) throw new Error(json.error ?? "Couldn't save the home");
      toast.success(
        json.matched ? `Home added · matches ${json.matched} client${json.matched === 1 ? "" : "s"}` : "Home added",
      );
      onClose();
      router.push(`/properties/${json.propertyId}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the home");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim sm:items-center" role="dialog" aria-modal="true" aria-label="Add a home">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:rounded-[28px]">
        <p className="font-heading text-[22px] text-foreground">Add a home</p>
        <p className="mb-4 font-display text-caption text-muted-foreground">
          Available homes are matched to clients and can be recommended by Aria.
        </p>

        <form
          className="mb-4 rounded-xl border border-border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp();
          }}
        >
          <label htmlFor="add-home-link" className="mb-2 flex items-center gap-1.5 font-display text-caption font-semibold text-foreground">
            <Link2 className="size-3.5" /> Add from link or MLS #
          </label>
          <div className="flex gap-2">
            <input
              id="add-home-link"
              ref={linkRef}
              className={FIELD}
              placeholder="Zillow, Realtor.com or NJMLS link — or MLS #"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <Button type="submit" disabled={looking || !link.trim()} className="h-auto shrink-0 rounded-xl px-4">
              {looking ? "Reading…" : "Fill in"}
            </Button>
          </div>
          {note ? <p className="mt-2 font-display text-caption text-muted-foreground">{note}</p> : null}
        </form>

        <div className="space-y-3">
          {f.photo && /^https:\/\//.test(f.photo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.photo} alt="" className="h-40 w-full rounded-xl object-cover" />
          ) : null}
          <input className={FIELD} placeholder="Street address *" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} aria-label="Street address" />
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} placeholder="Town *" value={f.town} onChange={(e) => setF({ ...f, town: e.target.value })} aria-label="Town" />
            <input className={FIELD} placeholder="Price" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} aria-label="Price" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className={FIELD} placeholder="Beds" inputMode="numeric" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value })} aria-label="Beds" />
            <input className={FIELD} placeholder="Baths" inputMode="decimal" value={f.baths} onChange={(e) => setF({ ...f, baths: e.target.value })} aria-label="Baths" />
            <input className={FIELD} placeholder="Sq ft" inputMode="numeric" value={f.sqft} onChange={(e) => setF({ ...f, sqft: e.target.value })} aria-label="Square feet" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} placeholder="MLS #" value={f.mlsNumber} onChange={(e) => setF({ ...f, mlsNumber: e.target.value })} aria-label="MLS number" />
            <select className={FIELD} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <input className={FIELD} placeholder="Photo URL (optional)" inputMode="url" value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} aria-label="Photo URL" />
          <textarea className={`${FIELD} resize-none`} rows={3} placeholder="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" />
          {f.sourceUrl ? (
            <p className="truncate font-display text-caption text-muted-foreground">
              From{" "}
              <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                {f.sourceUrl}
              </a>
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={save} disabled={saving} className="h-12 flex-1 rounded-xl text-body-lg font-semibold">
            {saving ? "Saving…" : "Save home"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-12 rounded-xl">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
