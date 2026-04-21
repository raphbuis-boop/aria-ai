"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { RichTextEditor } from "@/components/RichTextEditor";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  system_key: string | null;
  sort_order: number;
}

export function EmailTemplatesSection() {
  const toast = useToast();
  const [items, setItems] = useState<Template[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/email-templates");
    if (!res.ok) return;
    const data = (await res.json()) as { templates: Template[] };
    setItems(data.templates ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLocal(id: string, patch: Partial<Template>) {
    setItems((prev) =>
      prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev,
    );
  }

  async function save(t: Template) {
    setSaving(t.id);
    try {
      const res = await fetch(`/api/email-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          subject: t.subject,
          body: t.body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.toast(`Save failed: ${data.error ?? "unknown"}`, "warn");
        return;
      }
      toast.toast("Template saved", "success");
    } finally {
      setSaving(null);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const res = await fetch(`/api/email-templates/${t.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.toast("Delete failed", "warn");
      return;
    }
    toast.toast("Template deleted", "success");
    await load();
  }

  async function createBlank() {
    setCreating(true);
    try {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled template",
          subject: "Subject",
          body: "<p>Hi {{client_first_name}},</p><p></p>",
        }),
      });
      if (!res.ok) {
        toast.toast("Create failed", "warn");
        return;
      }
      const data = (await res.json()) as { template: Template };
      setExpandedId(data.template.id);
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <FileText size={14} className="text-[#6f9bff]" />
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Email templates
        </div>
      </div>

      <div className="space-y-2">
        {items === null ? (
          <div className="rounded-[14px] border border-border-card bg-bg-card p-3 text-[13px] text-text-dim">
            Loading templates…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-border-card bg-bg-card p-3 text-[13px] text-text-dim">
            No templates yet.
          </div>
        ) : (
          items.map((t) => (
            <div
              key={t.id}
              className="rounded-[14px] border border-border-card bg-bg-card"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expandedId === t.id ? null : t.id)
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-white">
                    {t.name}
                  </div>
                  <div className="truncate text-[11px] text-text-dim">
                    {t.subject}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.system_key ? (
                    <span className="rounded-md bg-[#4f7bff]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#6f9bff]">
                      Default
                    </span>
                  ) : null}
                  <span className="text-[11px] text-text-dim">
                    {expandedId === t.id ? "Hide" : "Edit"}
                  </span>
                </div>
              </button>

              {expandedId === t.id ? (
                <div className="space-y-3 border-t border-border-card p-4">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-dim">
                      Name
                    </label>
                    <input
                      value={t.name}
                      onChange={(e) =>
                        updateLocal(t.id, { name: e.target.value })
                      }
                      className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-dim">
                      Subject
                    </label>
                    <input
                      value={t.subject}
                      onChange={(e) =>
                        updateLocal(t.id, { subject: e.target.value })
                      }
                      className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px] text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-dim">
                      Body
                    </label>
                    <RichTextEditor
                      value={t.body}
                      onChange={(html) => updateLocal(t.id, { body: html })}
                      placeholder="Template body (supports HTML)"
                      minHeight={180}
                    />
                    <p className="mt-1 text-[10px] text-text-dim">
                      Variables: <code>{"{{client_name}}"}</code>,{" "}
                      <code>{"{{client_first_name}}"}</code>,{" "}
                      <code>{"{{agent_name}}"}</code>,{" "}
                      <code>{"{{property_address}}"}</code>,{" "}
                      <code>{"{{price}}"}</code>
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-300"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => save(t)}
                      disabled={saving === t.id}
                      className="rounded-[8px] bg-accent-blue px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                    >
                      {saving === t.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={createBlank}
        disabled={creating}
        className="mt-2 inline-flex items-center gap-1 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[12px] font-semibold text-text-secondary disabled:opacity-60"
      >
        <Plus size={12} /> {creating ? "Creating…" : "Add template"}
      </button>
    </div>
  );
}
