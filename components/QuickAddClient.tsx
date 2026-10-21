"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronDown, Contact, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneE164 } from "@/lib/utils";
import { isNativeApp, pickNativeContact } from "@/lib/contacts/native";

/** Opens Quick add from anywhere (Clients "+ Add", empty states). */
export const QUICK_ADD_EVENT = "aria:quick-add";
export function openQuickAdd() {
  window.dispatchEvent(new Event(QUICK_ADD_EVENT));
}

/** Screens where the floating button would sit on top of the screen's own job. */
const HIDE_BUTTON_ON = ["/voice", "/clients/import"];

const ROLES = ["buyer", "seller", "renter"] as const;
type Role = (typeof ROLES)[number];

/** How she met them — noted on the intake entry (lead_source stays "manual"). */
const ORIGINS = ["Referral", "Someone I know", "Open house", "Sign call", "Zillow", "Realtor.com", "Social media", "Website", "Other"];

const FIELD =
  "w-full rounded-xl border border-input bg-secondary px-4 py-3 font-display text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

const EMPTY = { name: "", phone: "", email: "", role: "buyer" as Role, origin: "", note: "" };

/**
 * Quick add: the floating "+" above the nav on every screen, and the sheet it
 * opens. Name plus a phone or email; lead type, source and a note are tucked
 * under "More". Saves through the same intake as every lead (/api/leads,
 * lead_source "manual", status "new") and never texts the person.
 */
export function QuickAdd() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(QUICK_ADD_EVENT, show);
    return () => window.removeEventListener(QUICK_ADD_EVENT, show);
  }, []);

  // Deep link: /clients?new=1 (Today and Follow-ups empty states).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (pathname === "/clients" && url.searchParams.get("new") === "1") {
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
      setOpen(true);
    }
  }, [pathname]);

  const hidden = HIDE_BUTTON_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      {hidden ? null : (
        <motion.button
          type="button"
          aria-label="Add client"
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className="fixed z-50 flex size-12 items-center justify-center rounded-full border border-border bg-card/90 text-primary shadow-float backdrop-blur-xl"
          style={{
            right: "calc(env(safe-area-inset-right) + 16px)",
            // Just above the nav pill (16px inset + 66px pill + a gap).
            bottom: "calc(env(safe-area-inset-bottom) + 96px)",
          }}
        >
          <UserPlus className="size-5" strokeWidth={2.1} />
        </motion.button>
      )}
      {open ? <QuickAddSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(EMPTY);
  const [more, setMore] = useState(false);
  const [native, setNative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; created: boolean } | null>(null);

  useEffect(() => {
    setNative(isNativeApp());
    nameRef.current?.focus();
  }, []);

  async function pick() {
    const c = await pickNativeContact();
    if (!c) return;
    setF((prev) => ({
      ...prev,
      name: c.name || prev.name,
      phone: c.phones[0] ?? prev.phone,
      email: c.emails[0] ?? prev.email,
    }));
    setError(null);
  }

  async function save() {
    const name = f.name.trim();
    const phone = f.phone.trim() ? formatPhoneE164(f.phone) : null;
    const email = f.email.trim().toLowerCase();
    if (name.length < 2) return setError("Add their name.");
    if (!f.phone.trim() && !email) return setError("Add a phone number or an email.");
    if (f.phone.trim() && !phone) return setError("That phone number looks incomplete — use all 10 digits.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("That email doesn't look right.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          autoText: false,
          name,
          phone: phone ?? "",
          email: email || null,
          clientRole: f.role,
          origin: f.origin || null,
          notes: f.note.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { clientId?: string; created?: boolean; error?: string };
      if (!res.ok || !json.clientId) throw new Error(json.error ?? "Couldn't add the client. Try again.");
      setSaved({ id: json.clientId, name, created: Boolean(json.created) });
      if (json.created) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the client. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function openProfile() {
    if (!saved) return;
    onClose();
    router.push(`/clients/${saved.id}`);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="Add client">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-b-0 border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:rounded-[28px] sm:border-b">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="font-heading text-[22px] text-foreground">Add client</p>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        {saved ? (
          <div className="py-2 text-center">
            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-5 text-primary" />
            </span>
            <p className="font-display text-body-lg font-semibold text-foreground">
              {saved.created ? `${saved.name} added` : `${saved.name} is already in your clients`}
            </p>
            <p className="mt-1 font-display text-caption text-muted-foreground">
              {saved.created ? "Aria won't text them — you decide when to reach out." : "Matched on their phone or email. Nothing was changed."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSaved(null);
                  setF(EMPTY);
                  setMore(false);
                  nameRef.current?.focus();
                }}
                className="h-11 rounded-xl text-body font-semibold"
              >
                Add another
              </Button>
              <Button onClick={openProfile} className="h-11 rounded-xl text-body font-semibold">
                Open profile
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {native ? (
              <button
                type="button"
                onClick={() => void pick()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background py-3 font-display text-body font-semibold text-foreground"
              >
                <Contact className="size-4 text-primary" /> Pick from contacts
              </button>
            ) : null}

            <div className="space-y-2.5">
              <input
                ref={nameRef}
                aria-label="Name"
                autoComplete="off"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                placeholder="Name"
                className={FIELD}
              />
              <input
                aria-label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                placeholder="Phone"
                className={FIELD}
              />
              <input
                aria-label="Email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
                placeholder="Email"
                className={FIELD}
              />
              <p className="px-1 font-display text-caption text-muted-foreground">A phone number or an email is enough.</p>
            </div>

            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 font-display text-caption font-semibold text-primary"
            >
              More details <ChevronDown className={`size-3.5 transition-transform ${more ? "rotate-180" : ""}`} />
            </button>

            {more ? (
              <div className="mt-3 space-y-3">
                <div role="radiogroup" aria-label="Lead type" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={f.role === r}
                      onClick={() => setF({ ...f, role: r })}
                      className={`rounded-lg py-2 font-display text-caption font-semibold capitalize ${f.role === r ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Source"
                  value={f.origin}
                  onChange={(e) => setF({ ...f, origin: e.target.value })}
                  className={`${FIELD} ${f.origin ? "" : "text-muted-foreground"}`}
                >
                  <option value="">How did you meet? (optional)</option>
                  {ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Note"
                  value={f.note}
                  onChange={(e) => setF({ ...f, note: e.target.value })}
                  placeholder="One-line note — e.g. looking in Teaneck, moving in spring"
                  maxLength={200}
                  className={FIELD}
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 font-display text-caption text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={saving} className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold">
              {saving ? "Adding…" : "Add client"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
