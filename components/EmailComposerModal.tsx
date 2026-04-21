"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Sparkles, X } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useToast } from "@/components/ToastProvider";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  system_key: string | null;
}

interface Property {
  id: string;
  address?: string | null;
  price?: number | null;
}

export interface EmailComposerInitial {
  to?: string | null;
  subject?: string;
  body?: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
}

export interface EmailComposerContext {
  clientId: string;
  clientName: string;
  clientFirstName?: string | null;
  clientEmail?: string | null;
  clientTown?: string | null;
  clientBudgetMax?: number | null;
  clientStatus?: string | null;
  agentName?: string | null;
  properties?: Property[];
  hasBba?: boolean;
}

interface Props {
  context: EmailComposerContext;
  initial?: EmailComposerInitial;
  onClose: () => void;
  onSent?: () => void;
}

function substituteVars(
  s: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return s.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_m, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function EmailComposerModal({
  context,
  initial,
  onClose,
  onSent,
}: Props) {
  const toast = useToast();
  const [to, setTo] = useState(initial?.to ?? context.clientEmail ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.body ?? "");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [attachBba, setAttachBba] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const firstName =
    context.clientFirstName ||
    context.clientName?.split(/\s+/)[0] ||
    "there";

  const templateVars = useMemo(
    () => ({
      client_name: context.clientName,
      client_first_name: firstName,
      agent_name: context.agentName ?? "",
      property_address: "",
      price: "",
    }),
    [context.clientName, firstName, context.agentName],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/email-templates");
        if (!res.ok) return;
        const data = (await res.json()) as { templates: EmailTemplate[] };
        setTemplates(data.templates ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(substituteVars(t.subject, templateVars));
    setBodyHtml(substituteVars(t.body, templateVars));
  }

  async function aiDraft() {
    setAiLoading(true);
    setErrorMsg(null);
    try {
      const contextSummary = [
        context.clientStatus ? `Status: ${context.clientStatus}.` : "",
        context.clientTown ? `Town: ${context.clientTown}.` : "",
        context.clientBudgetMax
          ? `Budget: $${context.clientBudgetMax.toLocaleString()}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      const res = await fetch("/api/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: context.clientId,
          clientName: context.clientName,
          clientFirstName: firstName,
          scenario:
            subject.trim() || "Warm follow-up / check-in email",
          context: contextSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(String(data.error ?? "AI draft failed"));
      } else {
        if (!subject.trim()) setSubject(String(data.subject ?? ""));
        setBodyHtml(String(data.body ?? ""));
      }
    } catch {
      setErrorMsg("Network error drafting email");
    } finally {
      setAiLoading(false);
    }
  }

  async function send() {
    setErrorMsg(null);
    if (!to.trim()) {
      setErrorMsg("To address is required");
      return;
    }
    if (!subject.trim()) {
      setErrorMsg("Subject is required");
      return;
    }
    if (!bodyHtml.trim()) {
      setErrorMsg("Body is required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: context.clientId,
          to: to.trim(),
          subject: subject.trim(),
          bodyHtml,
          templateId: selectedTemplate || null,
          propertyId: selectedProperty || null,
          attachBba: attachBba && !!context.hasBba,
          threadId: initial?.threadId ?? null,
          inReplyTo: initial?.inReplyTo ?? null,
          references: initial?.references ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(String(data.error ?? "Send failed"));
        setSending(false);
        return;
      }
      toast.toast("Email sent", "success");
      onSent?.();
      onClose();
    } catch {
      setErrorMsg("Network error sending email");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[92vh] w-full max-w-2xl flex-col rounded-t-[20px] border border-[#1e1e2e] bg-[#0a0a0f] text-white sm:h-[85vh] sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-[#1e1e2e] px-4 py-3">
          <div className="text-[15px] font-semibold">
            New email · {context.clientName}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-[#888898] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Row label="To">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
              type="email"
              className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0c0c14] px-3 py-2 text-[14px] text-white"
            />
          </Row>

          <Row label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0c0c14] px-3 py-2 text-[14px] text-white"
            />
          </Row>

          <div className="flex flex-wrap gap-2">
            {templates.length > 0 ? (
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  if (e.target.value) applyTemplate(e.target.value);
                }}
                className="rounded-[8px] border border-[#1e1e2e] bg-[#0c0c14] px-2 py-1.5 text-[12px] text-[#d0d0e0]"
              >
                <option value="">Use template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={aiDraft}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#4f7bff]/40 bg-[#4f7bff]/10 px-3 py-1.5 text-[12px] font-semibold text-[#6f9bff] disabled:opacity-60"
            >
              <Sparkles size={12} />
              {aiLoading ? "Drafting…" : "AI draft"}
            </button>
          </div>

          <RichTextEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            placeholder="Write your email…"
            minHeight={220}
          />

          <div className="rounded-[10px] border border-[#1e1e2e] bg-[#0c0c14] p-3 text-[12px] text-[#9090a8]">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#d0d0e0]">
              <Paperclip size={12} /> Attachments
            </div>

            {(context.properties ?? []).length > 0 ? (
              <label className="mb-2 block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-[#555570]">
                  Inline property card
                </span>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-2 py-1.5 text-[12px] text-[#d0d0e0]"
                >
                  <option value="">None</option>
                  {(context.properties ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address ?? p.id}
                      {p.price ? ` — $${p.price.toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mb-2 text-[11px] italic text-[#555570]">
                No matched properties to attach yet.
              </div>
            )}

            <label className="flex items-center gap-2 text-[12px] text-[#d0d0e0]">
              <input
                type="checkbox"
                checked={attachBba}
                disabled={!context.hasBba}
                onChange={(e) => setAttachBba(e.target.checked)}
              />
              {context.hasBba
                ? "Attach latest signed BBA (PDF)"
                : "Attach BBA (no signed BBA on file)"}
            </label>
          </div>

          {errorMsg ? (
            <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
              {errorMsg}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#1e1e2e] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-[#1e1e2e] bg-[#12121e] px-4 py-2 text-[13px] font-semibold text-[#9090a8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="rounded-[8px] bg-[#4f7bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-[#555570]">
        {label}
      </span>
      {children}
    </label>
  );
}
