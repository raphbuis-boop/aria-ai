"use client";

import { useToast } from "@/components/ToastProvider";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function ListingInquiryForm({
  listingId,
  listingAddress,
  mlsNumber,
}: {
  listingId: string;
  listingAddress: string;
  mlsNumber: string | null;
}) {
  const toast = useToast();
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [intent, setIntent] = useState<"info" | "showing">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
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
          listing_id: listingId,
          listing_address: listingAddress,
          mls_number: mlsNumber ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.toast(data.error ?? "Could not send", "warn");
        return;
      }
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
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      id="listing-inquiry"
      className="mt-8 rounded-[12px] border border-border-card bg-bg-card px-4 py-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
        Contact
      </p>
      {step === "choose" ? (
        <>
          <p className="mt-1 text-[13px] text-text-primary">
            Interested in this listing? Choose an option to send a message to the
            listing office.
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
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="mt-2 text-[12px] font-medium text-accent-blue"
          >
            ← Back
          </button>
          <p className="mt-2 text-[13px] text-text-primary">
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
            Name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-text-dim">
            Email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary"
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
            className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary"
            autoComplete="tel"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-text-dim">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={
              intent === "showing"
                ? "Preferred days/times for a tour…"
                : "What would you like to know about this listing?"
            }
            className="mt-1 w-full resize-y rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
          />
        </div>
        <p className="text-[11px] text-text-muted">
          Listing: {listingAddress || "—"}
          {mlsNumber ? ` · #${mlsNumber}` : ""}
        </p>
            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-accent-blue py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {sending ? <Loader2 className="animate-spin" size={18} /> : null}
              {sending
                ? "Sending…"
                : intent === "showing"
                  ? "Submit Schedule Showing"
                  : "Submit Request Info"}
            </button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-[12px] text-text-dim">
        Agents:{" "}
        <a href="/login" className="font-medium text-accent-blue">
          Sign in
        </a>{" "}
        for watchlist and CRM tools.
      </p>
    </div>
  );
}
