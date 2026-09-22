"use client";

import { useToast } from "@/components/ToastProvider";
import { track } from "@/lib/analytics";
import { X, Loader2 } from "lucide-react";
import { useState } from "react";

interface ListingInquiryFormProps {
  listingId: string;
  listingAddress: string;
  mlsNumber: string | null;
  listingPrice?: number;
  /** Render as a fixed bottom-sheet overlay instead of an inline card. */
  modal?: boolean;
  /** Called after a successful submit or when the user dismisses the modal. */
  onClose?: () => void;
  /** Pre-select intent when opened from a specific CTA. */
  initialIntent?: "info" | "showing";
}

export function ListingInquiryForm({
  listingId,
  listingAddress,
  mlsNumber,
  listingPrice,
  modal = false,
  onClose,
  initialIntent = "info",
}: ListingInquiryFormProps) {
  const toast = useToast();
  const [step, setStep] = useState<"choose" | "form">(
    modal ? "form" : "choose",
  );
  const [intent, setIntent] = useState<"info" | "showing">(initialIntent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);

  function openForm(next: "info" | "showing") {
    setIntent(next);
    setStep("form");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/listing-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          name,
          email,
          phone,
          message,
          sms_consent: Boolean(phone.trim()) && smsConsent,
          listing_id: listingId,
          listing_address: listingAddress,
          mls_number: mlsNumber ?? "",
          listing_price: listingPrice ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.toast(data.error ?? "Could not send", "warn");
        return;
      }
      track("inquiry_submitted", {
        source: "website",
        listing_id: listingId,
        has_phone: Boolean(phone.trim()),
        has_email: Boolean(email.trim()),
      });
      toast.toast(
        intent === "showing"
          ? "Showing request sent. An agent will follow up."
          : "Request sent. An agent will follow up.",
        "success",
      );
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setStep("choose");
      onClose?.();
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSending(false);
    }
  }

  const formContent = (
    <>
      {!modal && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
          Contact
        </p>
      )}

      {step === "choose" ? (
        <>
          <p className="mt-1 text-[13px] text-text-primary">
            Interested in this listing? Choose an option to send a message to
            the listing office.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => openForm("info")}
              className="flex-1 rounded-[10px] bg-accent-blue px-4 py-3 text-[13px] font-semibold text-white"
            >
              Request Info
            </button>
            <button
              type="button"
              onClick={() => openForm("showing")}
              className="flex-1 rounded-[10px] border border-border-card bg-bg-deep px-4 py-3 text-[13px] font-semibold text-text-primary"
            >
              Schedule Showing
            </button>
          </div>
        </>
      ) : (
        <>
          {!modal && (
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="mt-2 text-[12px] font-medium text-accent-blue"
            >
              ← Back
            </button>
          )}
          <p className={`text-[13px] text-text-primary ${modal ? "" : "mt-2"}`}>
            {intent === "showing"
              ? "Schedule a showing — we will follow up with available times."
              : "Request more information about this listing."}
          </p>
          <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden
            />
            <div>
              <label className="text-[10px] font-bold uppercase text-text-dim">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary focus:border-accent-blue/60 focus:outline-none"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-dim">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary focus:border-accent-blue/60 focus:outline-none"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-dim">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary focus:border-accent-blue/60 focus:outline-none"
                autoComplete="tel"
              />
              {phone.trim() ? (
                <label className="mt-2 flex items-start gap-2 text-[11px] leading-snug text-text-muted">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Text me about this home and similar listings. Msg &amp; data
                    rates may apply. Reply STOP to opt out.
                  </span>
                </label>
              ) : null}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-dim">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="When would you like to see it? Any questions?"
                className="mt-1 w-full resize-none rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim focus:border-accent-blue/60 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-text-muted">
              Listing: {listingAddress || "—"}
              {mlsNumber ? ` · #${mlsNumber}` : ""}
            </p>
            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent-blue py-3 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {sending ? <Loader2 className="animate-spin" size={16} /> : null}
              {sending
                ? "Sending…"
                : intent === "showing"
                  ? "Request Showing"
                  : "Request Info"}
            </button>
          </form>
        </>
      )}

      {!modal && (
        <p className="mt-4 text-center text-[12px] text-text-dim">
          Agents:{" "}
          <a href="/login" className="font-medium text-accent-blue">
            Sign in
          </a>{" "}
          for watchlist and CRM tools.
        </p>
      )}
    </>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[2px]">
        {/* backdrop dismiss */}
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-lg rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e2230] bg-[#0d0f16] px-5 pb-10 pt-4">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2e40]" />
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-text-primary">
              {intent === "showing" ? "Schedule a Showing" : "Contact Agent"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e2230] text-text-dim"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div
      id="listing-inquiry"
      className="mt-8 rounded-[12px] border border-border-card bg-bg-card px-4 py-4"
    >
      {formContent}
    </div>
  );
}
