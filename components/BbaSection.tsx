"use client";

import { useToast } from "@/components/ToastProvider";
import {
  Check,
  Copy,
  Download,
  FileSignature,
  FileText,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BbaRecord = {
  signed_at: string;
  commission_pct: number;
  term_start: string;
  term_end: string;
  search_area: string | null;
  agent_name: string;
  client_name: string;
} | null;

type TemplateDto = {
  id: string;
  template_name: string;
  is_default: boolean;
};

export function BbaSection({
  clientId,
  clientName,
  clientPhone,
  initialBba,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  initialBba: BbaRecord;
}) {
  const toast = useToast();
  const [bba, setBba] = useState<BbaRecord>(initialBba);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | "">("");
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    setBba(initialBba);
  }, [initialBba]);

  // Once signed, pull a fresh short-lived signed URL for the PDF so the agent
  // can download their client's completed BBA straight from this page.
  useEffect(() => {
    if (!bba) {
      setSignedPdfUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bba/${clientId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setSignedPdfUrl(json.signed_pdf_url ?? null);
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bba, clientId]);

  // Pull the agent's brokerage templates so they can pick which one to send.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bba-templates", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const list = (json.templates ?? []) as TemplateDto[];
        setTemplates(list);
        const def = list.find((t) => t.is_default) ?? list[0];
        if (def) setSelectedTemplate(def.id);
      } catch {
        // Settings UI surfaces errors; silently skip here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signed = !!bba;
  const signingUrl = useMemo(() => {
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}/bba/sign/${clientId}`
        : `/bba/sign/${clientId}`;
    return selectedTemplate ? `${base}?template=${selectedTemplate}` : base;
  }, [clientId, selectedTemplate]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signingUrl);
      toast.toast("Link copied", "success");
    } catch {
      toast.toast("Could not copy", "warn");
    }
  }

  async function sendSms() {
    if (!clientPhone) {
      toast.toast("No phone on file — copy the link instead", "warn");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          to: clientPhone,
          body: `Hi ${clientName.split(" ")[0]} — before our next showing, NJ requires a quick Buyer Broker Agreement. Takes 30 seconds on your phone: ${signingUrl}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.toast(String(data.error ?? "SMS failed"), "warn");
      } else {
        toast.toast("Link texted to client", "success");
      }
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSending(false);
    }
  }

  const templateSelector =
    templates.length > 1 ? (
      <label className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-2.5 py-1.5">
        <FileText size={12} className="text-[#666680]" />
        <span className="text-[10px] uppercase tracking-wider text-[#666680]">
          Template
        </span>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-[#d0d0e0] outline-none"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.template_name}
              {t.is_default ? " · default" : ""}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <div>
      {signed ? (
        <div className="rounded-2xl border border-[#1a2a1a] bg-[#0f1a10] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#50dc78]/15 text-[#50dc78]">
              <Check size={16} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider rounded-md bg-[#50dc78]/15 text-[#50dc78] px-2 py-0.5">
                  Signed
                </span>
                <span className="text-[11px] text-[#555570]">
                  {new Date(bba!.signed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[#d0d0e0]">
                {bba!.commission_pct}% · term {bba!.term_start} → {bba!.term_end}
              </p>
              {bba!.search_area ? (
                <p className="text-[11px] text-[#666680]">
                  Search area: {bba!.search_area}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={`/bba/sign/${clientId}`}
              className="rounded-[10px] border border-[#1e1e2e] bg-[#12121e] py-2 text-center text-[12px] font-semibold text-[#9090a8]"
            >
              View / re-sign
            </Link>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[#1e1e2e] bg-[#12121e] py-2 text-[12px] font-semibold text-[#9090a8]"
            >
              <Copy size={12} /> Copy link
            </button>
          </div>
          {signedPdfUrl ? (
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-[10px] border border-[#50dc78]/30 bg-[#50dc78]/5 py-2 text-[12px] font-semibold text-[#50dc78]"
            >
              <Download size={12} /> Download signed PDF
            </a>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#2a1a1a] bg-[#1a0f0f] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#ff5050]/15 text-[#ff6060]">
              <ShieldAlert size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider rounded-md bg-[#ff5050]/15 text-[#ff6060] px-2 py-0.5">
                  Not signed
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[#f0eee8]">
                BBA required before next showing
              </p>
              <p className="text-[11px] text-[#9090a8]">
                NJ / NAR settlement rule. Text the signing link to{" "}
                {clientName.split(" ")[0]} so they can sign on their phone.
              </p>
            </div>
          </div>
          {templateSelector}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={sendSms}
              disabled={sending || !clientPhone}
              className="flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] py-2 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              <FileSignature size={12} />
              {sending ? "Sending…" : "Send BBA for signature"}
            </button>
            <Link
              href={signingUrl.replace(
                typeof window !== "undefined" ? window.location.origin : "",
                "",
              )}
              className="rounded-[10px] border border-[#2a2a3e] py-2 text-center text-[12px] font-semibold text-[#9090a8]"
            >
              Sign in person
            </Link>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] text-[#6f9bff]"
          >
            <Copy size={11} /> Copy signing link
          </button>
        </div>
      )}
    </div>
  );
}
