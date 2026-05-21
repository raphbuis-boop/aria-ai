"use client";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type DocumentRow = {
  id: string;
  category: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "purchase_offer", label: "Purchase Offer" },
  { value: "counter_offer", label: "Counter Offer" },
  { value: "inspection_report", label: "Inspection Report" },
  { value: "disclosure", label: "Disclosure" },
  { value: "appraisal", label: "Appraisal" },
  { value: "mortgage_docs", label: "Mortgage Docs" },
  { value: "closing_docs", label: "Closing Docs" },
  { value: "bba", label: "BBA" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

const ACCEPT =
  "application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fileIconFor(mime: string | null) {
  if (mime?.startsWith("image/")) return ImageIcon;
  return FileText;
}

export function ContractsSection({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/client-documents?clientId=${encodeURIComponent(clientId)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!cancelled && res.ok) setDocs((json.documents ?? []) as DocumentRow[]);
      } catch {
        /* handled by toast on actions */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function onUploaded(doc: DocumentRow) {
    setDocs((prev) => [doc, ...prev]);
    setUploadOpen(false);
    toast.toast("Document uploaded", "success");
  }

  async function remove(doc: DocumentRow) {
    const res = await fetch(`/api/client-documents/${doc.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.toast("Document deleted", "success");
    } else {
      const json = await res.json().catch(() => ({}));
      toast.toast(String(json.error ?? "Could not delete"), "warn");
    }
    setConfirmDelete(null);
  }

  return (
    <>
      <CollapsibleSection
        title="Contracts & Documents"
        summary={docs.length ? `${docs.length} file${docs.length === 1 ? "" : "s"}` : null}
        right={
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1 rounded-[10px] border-[0.5px] border-[#2a2e40] bg-[#12121e] px-2.5 py-1 text-[11px] font-semibold text-[#9090a8] active:border-[#3a65f0]"
          >
            <Plus size={12} /> Upload
          </button>
        }
      >
        <p className="mb-3 text-[11px] leading-relaxed text-[#9498b0]">
          Per-client PDFs (including a signed or draft BBA) live here. Your
          default PDF for BBA signing links is managed in{" "}
          <Link
            href="/settings#bba-templates"
            className="font-semibold text-[#6b8fff] underline-offset-2 hover:underline"
          >
            Settings → BBA Templates
          </Link>
          .
        </p>
        {loading ? (
          <div className="rounded-2xl border border-[#1e2230] bg-[#12121e] p-4 text-center text-[12px] text-[#555570]">
            Loading documents…
          </div>
        ) : docs.length === 0 ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#2a2e40] bg-[#12121e] px-4 py-6 text-[12.5px] text-[#9498b0] hover:border-[#3a65f0]/40 hover:text-[#9090a8]"
          >
            <Upload size={18} />
            <span>No documents yet — tap to upload</span>
          </button>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => {
              const Icon = fileIconFor(doc.mime_type);
              return (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#1e2230] bg-[#12121e] px-3 py-2.5"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#3a65f0]/12 text-[#6b8fff]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#e8eaf2]">
                      {doc.file_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#555570]">
                      <span className="text-[#9090a8]">
                        {CATEGORY_LABEL.get(doc.category) ?? doc.category}
                      </span>
                      {" · "}
                      {formatDate(doc.uploaded_at)}
                      {" · "}
                      {formatSize(doc.file_size)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    {doc.signed_url ? (
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1e2230] bg-[#0a0a15] text-[#9090a8] active:border-[#3a65f0]"
                        aria-label="Open"
                        title="Open"
                      >
                        <ExternalLink size={13} />
                      </a>
                    ) : null}
                    {doc.signed_url ? (
                      <a
                        href={doc.signed_url}
                        download={doc.file_name}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1e2230] bg-[#0a0a15] text-[#9090a8] active:border-[#3a65f0]"
                        aria-label="Download"
                        title="Download"
                      >
                        <Download size={13} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#1e2230] bg-[#0a0a15] text-[#c43838] active:border-[#c43838]/50"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleSection>

      {uploadOpen ? (
        <UploadModal
          clientId={clientId}
          onClose={() => setUploadOpen(false)}
          onUploaded={onUploaded}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete document?"
        message={
          confirmDelete
            ? `Remove "${confirmDelete.file_name}"? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => (confirmDelete ? remove(confirmDelete) : Promise.resolve())}
      />
    </>
  );
}

function UploadModal({
  clientId,
  onClose,
  onUploaded,
}: {
  clientId: string;
  onClose: () => void;
  onUploaded: (doc: DocumentRow) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("purchase_offer");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!file) {
      toast.toast("Choose a file first", "warn");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("category", category);
      if (notes.trim()) fd.append("notes", notes.trim());
      fd.append("file", file);
      const res = await fetch("/api/client-documents", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.toast(String(json.error ?? "Upload failed"), "warn");
      } else if (json.document) {
        onUploaded(json.document as DocumentRow);
      }
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6 pt-24 sm:items-center">
      <div className="w-full max-w-md rounded-[18px] border border-[#1e2230] bg-[#0d0f16] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#e8eaf2]">
            Upload document
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[#1e2230] text-[#9090a8]"
          >
            <X size={14} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#6b7090]">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-[10px] border border-[#1e2230] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#e8eaf2] outline-none focus:border-[#3a65f0]/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#6b7090]">
            File
          </span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-between gap-2 rounded-[10px] border-[0.5px] border-[#2a2e40] bg-[#0a0a15] px-3 py-2.5 text-[13px] text-[#9090a8] active:border-[#3a65f0]"
          >
            <span className="min-w-0 truncate">
              {file ? file.name : "Choose file (PDF, image, doc)"}
            </span>
            <Upload size={14} />
          </button>
          {file ? (
            <p className="mt-1 text-[11px] text-[#555570]">
              {formatSize(file.size)}
            </p>
          ) : null}
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#6b7090]">
            Notes (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Submitted 3/15 — waiting on seller response"
            className="w-full resize-none rounded-[10px] border border-[#1e2230] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#e8eaf2] outline-none placeholder:text-[#6b7090] focus:border-[#3a65f0]/40"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border-[0.5px] border-[#2a2e40] bg-[#12121e] py-2.5 text-[13px] font-semibold text-[#9090a8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !file}
            className="rounded-[10px] bg-gradient-to-br from-[#3a65f0] to-[#7c5cfc] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContractsSection;
