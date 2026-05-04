"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { Check, FileText, Star, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type TemplateDto = {
  id: string;
  brokerage_id: string;
  template_name: string;
  storage_path: string;
  is_default: boolean;
  uploaded_at: string;
  signed_url: string | null;
};

export function BbaTemplatesSection() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<TemplateDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateDto | null>(null);
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bba-templates", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.toast(String(json.error ?? "Could not load templates"), "warn");
        setTemplates([]);
      } else {
        setTemplates((json.templates ?? []) as TemplateDto[]);
      }
    } catch {
      toast.toast("Network error loading templates", "warn");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.toast("Only PDF files are supported", "warn");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("template_name", file.name.replace(/\.pdf$/i, ""));
      const res = await fetch("/api/bba-templates", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.toast(String(json.error ?? "Upload failed"), "warn");
      } else {
        toast.toast("Template uploaded", "success");
        await refresh();
      }
    } catch {
      toast.toast("Upload failed", "warn");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/bba-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.toast(String(j.error ?? "Could not set default"), "warn");
      return;
    }
    toast.toast("Default template updated", "success");
    setTemplates((prev) =>
      prev.map((t) => ({ ...t, is_default: t.id === id })),
    );
  }

  async function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingName(null);
      return;
    }
    const res = await fetch(`/api/bba-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_name: trimmed }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.toast(String(j.error ?? "Rename failed"), "warn");
    } else {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, template_name: trimmed } : t,
        ),
      );
    }
    setEditingName(null);
  }

  async function remove(id: string) {
    setConfirmDelete(null);
    const res = await fetch(`/api/bba-templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.toast(String(j.error ?? "Delete failed"), "warn");
      return;
    }
    toast.toast("Template removed", "success");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div id="bba-templates" className="mt-8 scroll-mt-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          BBA Templates
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border-card px-2.5 py-1 text-[11px] font-medium text-accent-blue disabled:opacity-60"
        >
          <Upload size={12} />
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
      <p className="mt-1 text-[12px] text-text-dim">
        Upload your brokerage&apos;s Buyer Broker Agreement PDF. The default
        template is auto-attached when you send a BBA signing link to a client.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className={`mt-3 rounded-[12px] border border-dashed px-3 py-6 text-center text-[12px] transition ${
          dragOver
            ? "border-accent-blue bg-accent-blue/5 text-accent-blue"
            : "border-border-card text-text-dim"
        }`}
      >
        Drop a PDF here to upload, or click{" "}
        <button
          type="button"
          className="font-medium text-accent-blue underline"
          onClick={() => fileRef.current?.click()}
        >
          choose a file
        </button>
        . Max 15 MB.
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-[12px] text-text-dim">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="rounded-[12px] border border-border-card bg-bg-card px-3 py-4 text-[12px] text-text-dim">
            No templates yet. Aria&apos;s generic NJ agreement is used as a
            fallback until you upload one.
          </p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-[12px] border border-border-card bg-bg-card px-3 py-2.5"
            >
              <FileText size={16} className="flex-shrink-0 text-accent-blue" />
              <div className="min-w-0 flex-1">
                {editingName?.id === t.id ? (
                  <input
                    autoFocus
                    value={editingName.value}
                    onChange={(e) =>
                      setEditingName({ id: t.id, value: e.target.value })
                    }
                    onBlur={() => rename(t.id, editingName.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(t.id, editingName.value);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    className="w-full rounded-[6px] border border-border-card bg-bg-deep px-2 py-1 text-[13px] text-text-primary outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingName({ id: t.id, value: t.template_name })
                    }
                    className="block w-full truncate text-left text-[13px] font-medium text-text-primary"
                  >
                    {t.template_name}
                  </button>
                )}
                <p className="text-[10px] text-text-dim">
                  Uploaded{" "}
                  {new Date(t.uploaded_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {t.is_default ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <Star size={10} fill="currentColor" /> Default
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefault(t.id)}
                  className="rounded-[6px] border border-border-card px-2 py-1 text-[11px] text-accent-blue"
                >
                  Set default
                </button>
              )}
              {t.signed_url ? (
                <button
                  type="button"
                  onClick={() => setPreview(t)}
                  className="rounded-[6px] border border-border-card px-2 py-1 text-[11px] text-text-dim"
                >
                  Preview
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmDelete(t)}
                className="rounded-[6px] border border-border-card px-2 py-1 text-[11px] text-red-400"
                aria-label={`Delete ${t.template_name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {preview && preview.signed_url ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3">
          <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[16px] border border-border-card bg-bg-card">
            <div className="flex items-center justify-between border-b border-border-card px-4 py-2.5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
                <Check size={14} className="text-accent-blue" />
                {preview.template_name}
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-[6px] border border-border-card px-2 py-1 text-[11px] text-text-dim"
              >
                Close
              </button>
            </div>
            <iframe
              src={preview.signed_url}
              title={preview.template_name}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this template?"
        message={
          confirmDelete
            ? `${confirmDelete.template_name} will be permanently removed. Existing signed agreements remain on file.`
            : ""
        }
        confirmLabel="Delete template"
        onConfirm={async () => {
          if (confirmDelete) await remove(confirmDelete.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
