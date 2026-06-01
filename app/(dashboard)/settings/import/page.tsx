"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { UploadStep } from "@/components/csv-import/UploadStep";
import { MappingStep } from "@/components/csv-import/MappingStep";
import { PreviewStep } from "@/components/csv-import/PreviewStep";
import {
  buildImportPayload,
  buildPreviewRows,
  type FieldMapping,
  type ParsedCSV,
  type PreviewRow,
} from "@/components/csv-import/utils";
import type { CsvMappingItem } from "@/app/api/ai/map-csv/route";

type Step = "upload" | "mapping" | "preview" | "done";

type ImportResult = {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

const STEP_LABELS: Record<Step, string> = {
  upload: "Upload",
  mapping: "Map columns",
  preview: "Preview",
  done: "Done",
};
const STEP_ORDER: Step[] = ["upload", "mapping", "preview", "done"];

export default function ImportPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<FieldMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Step 1 → 2: file selected, call AI mapper ──────────────────────────────
  async function handleFile(parsed: ParsedCSV, fname: string) {
    setCsv(parsed);
    setFilename(fname);
    setMappingLoading(true);

    try {
      const res = await fetch("/api/ai/map-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: parsed.headers }),
      });
      const data = (await res.json()) as { mapping?: CsvMappingItem[]; error?: string };
      const aiMapping: FieldMapping[] = (data.mapping ?? []).map((m) => ({
        header: m.header,
        field: m.field as FieldMapping["field"],
        confidence: m.confidence,
      }));
      // Ensure every header has a mapping entry
      const mapped = new Set(aiMapping.map((m) => m.header));
      for (const h of parsed.headers) {
        if (!mapped.has(h)) aiMapping.push({ header: h, field: "skip", confidence: "low" });
      }
      setMapping(aiMapping);
    } catch {
      // Fallback: all skip
      setMapping(parsed.headers.map((h) => ({ header: h, field: "skip" as const, confidence: "low" as const })));
    } finally {
      setMappingLoading(false);
    }

    setStep("mapping");
  }

  // ── Step 2 → 3: build preview rows ────────────────────────────────────────
  function handleMappingContinue() {
    if (!csv) return;
    const rows = buildPreviewRows(csv.headers, csv.rows, mapping);
    setPreviewRows(rows);
    setStep("preview");
  }

  // ── Step 3 → 4: run import ─────────────────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    setImportError(null);
    const payload = buildImportPayload(previewRows);

    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Import failed. Try again.");
        return;
      }
      setResult(data);
      setStep("done");
    } catch {
      setImportError("Network error. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e8eaf2",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* Header */}
        <div style={{ paddingTop: 24, paddingBottom: 28 }}>
          <Link
            href="/settings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#6b7090",
              fontSize: 14,
              textDecoration: "none",
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={15} />
            Settings
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>
            Import contacts
          </h1>
          <p style={{ color: "#6b7090", fontSize: 14 }}>
            Upload a CSV to add clients to your pipeline.
          </p>
        </div>

        {/* Step indicator */}
        {step !== "done" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 28, alignItems: "center" }}>
            {STEP_ORDER.filter((s) => s !== "done").map((s, i) => {
              const current = stepIndex;
              const idx = STEP_ORDER.indexOf(s);
              const done = idx < current;
              const active = idx === current;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: done ? "#3a65f0" : active ? "rgba(58,101,240,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${done || active ? "#3a65f0" : "rgba(255,255,255,0.10)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        color: done ? "#fff" : active ? "#3a65f0" : "#424560",
                        flexShrink: 0,
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: active ? 500 : 400,
                        color: active ? "#e8eaf2" : done ? "#9498b0" : "#424560",
                        display: i === 2 ? "none" : undefined, // hide "Preview" label on small screens via media — inline for now
                      }}
                    >
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      style={{
                        width: 24,
                        height: 1,
                        background: idx < current ? "#3a65f0" : "rgba(255,255,255,0.08)",
                        marginLeft: 2,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step content */}
        <div
          style={{
            background: "#0d0f16",
            border: "0.5px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "22px 20px",
          }}
        >
          {step === "upload" && (
            <UploadStep onFile={handleFile} />
          )}

          {step === "mapping" && csv && (
            <MappingStep
              mapping={mapping}
              filename={filename}
              rowCount={csv.rows.length}
              onUpdateMapping={setMapping}
              onBack={() => setStep("upload")}
              onContinue={handleMappingContinue}
              loading={mappingLoading}
            />
          )}

          {step === "preview" && (
            <>
              <PreviewStep
                rows={previewRows}
                onUpdateRows={setPreviewRows}
                onBack={() => setStep("mapping")}
                onImport={handleImport}
                importing={importing}
              />
              {importError && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: 13,
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "rgba(239,68,68,0.08)",
                    borderRadius: 8,
                    border: "0.5px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {importError}
                </p>
              )}
            </>
          )}

          {step === "done" && result && (
            <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <CheckCircle size={26} color="#10b981" />
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
                {result.inserted} client{result.inserted !== 1 ? "s" : ""} imported
              </p>
              {result.skipped > 0 && (
                <p style={{ color: "#6b7090", fontSize: 13, marginBottom: 4 }}>
                  {result.skipped} duplicate{result.skipped !== 1 ? "s" : ""} skipped
                </p>
              )}
              {result.errors.length > 0 && (
                <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 4 }}>
                  {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} could not be imported
                </p>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCsv(null);
                    setMapping([]);
                    setPreviewRows([]);
                    setResult(null);
                    setStep("upload");
                  }}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    borderRadius: 9,
                    color: "#9498b0",
                    fontSize: 14,
                    fontWeight: 500,
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  Import another file
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/clients")}
                  style={{
                    flex: 1,
                    background: "#3a65f0",
                    border: "none",
                    borderRadius: 9,
                    color: "#ffffff",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  Go to contacts →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
