"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

// ── Types ──────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

type CsvSubStep = "upload" | "mapping" | "preview" | "done";

type ImportResult = {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

type Props = {
  userId: string;
  initialName: string;
  /** If Gmail was just connected (callback returned ?gmail=connected), start on step 3 */
  initialStep: WizardStep;
  gmailConnected: boolean;
};

// ── Progress bar ───────────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Welcome",
  2: "Gmail",
  3: "Clients",
  4: "Done",
};

function ProgressBar({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {([1, 2, 3, 4] as WizardStep[]).map((s) => (
        <div key={s} className="flex flex-col items-center gap-1">
          <div
            style={{
              width: s === step ? 28 : 8,
              height: 4,
              borderRadius: 99,
              background: s === step ? "#3B82F6" : s < step ? "#10B981" : "rgba(255,255,255,0.12)",
              transition: "all 400ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Skip button ────────────────────────────────────────────────────────────────

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full py-3 text-[13px] font-medium"
      style={{ color: "#4B5563" }}
    >
      Skip for now
    </button>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export function OnboardingWizard({ userId, initialName, initialStep, gmailConnected: initialGmailConnected }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<WizardStep>(initialStep);
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected);

  // CSV sub-state (step 3)
  const [csvSubStep, setCsvSubStep] = useState<CsvSubStep>("upload");
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<FieldMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Finish: mark onboarding complete ──────────────────────────────────────

  const finish = useCallback(async () => {
    await supabase
      .from("agent_profiles")
      .upsert({ id: userId, onboarding_complete: true });
    router.push("/dashboard");
  }, [supabase, userId, router]);

  // ── Step 1 → 2 ────────────────────────────────────────────────────────────

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) { setStep(2); return; }
    setSavingName(true);
    await supabase
      .from("agent_profiles")
      .upsert({ id: userId, full_name: trimmed });
    setSavingName(false);
    setStep(2);
  }

  // ── Step 2: Gmail ─────────────────────────────────────────────────────────

  function handleGmailConnect() {
    // Cookie tells the OAuth callback to return to /onboarding instead of /settings
    document.cookie = "aria_return_to=onboarding; path=/; max-age=600; SameSite=Lax";
    window.location.href = "/api/auth/google/connect";
  }

  // ── Step 3: CSV import ───────────────────────────────────────────────────

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
      const mapped = new Set(aiMapping.map((m) => m.header));
      for (const h of parsed.headers) {
        if (!mapped.has(h)) aiMapping.push({ header: h, field: "skip", confidence: "low" });
      }
      setMapping(aiMapping);
    } catch {
      setMapping(parsed.headers.map((h) => ({ header: h, field: "skip" as const, confidence: "low" as const })));
    } finally {
      setMappingLoading(false);
    }
    setCsvSubStep("mapping");
  }

  function handleMappingContinue() {
    if (!csv) return;
    setPreviewRows(buildPreviewRows(csv.headers, csv.rows, mapping));
    setCsvSubStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: buildImportPayload(previewRows) }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) { setImportError(data.error ?? "Import failed."); return; }
      setImportResult(data);
      setCsvSubStep("done");
    } catch {
      setImportError("Network error. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{
        background: "#040407",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        className="relative z-10 mx-auto flex w-full max-w-[420px] flex-col px-6"
        style={{
          paddingTop: "max(3rem, env(safe-area-inset-top) + 2rem)",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 1rem)",
          minHeight: "100dvh",
        }}
      >
        {/* Aria wordmark */}
        <p
          className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "#3B82F6" }}
        >
          Aria
        </p>

        <ProgressBar step={step} />

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div className="flex flex-col">
            <h1 className="mb-2 text-[28px] font-bold tracking-tight">
              Welcome to Aria
            </h1>
            <p className="mb-8 text-[15px]" style={{ color: "#6B7280" }}>
              Your AI-powered real estate CRM. Let&apos;s get you set up in 2 minutes.
            </p>

            <label className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#6B7280" }}>
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              onKeyDown={(e) => { if (e.key === "Enter") void handleSaveName(); }}
              className="rounded-[14px] px-4 py-3.5 text-[16px] text-white outline-none"
              style={{
                background: "rgba(20,20,22,0.6)",
                border: "0.5px solid rgba(255,255,255,0.10)",
              }}
            />

            <button
              type="button"
              onClick={() => void handleSaveName()}
              disabled={savingName}
              className="mt-4 w-full rounded-full py-4 text-[16px] font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #3B82F6, #06B6D4)" }}
            >
              {savingName ? "Saving…" : "Continue →"}
            </button>

            <SkipButton onClick={() => setStep(2)} />
          </div>
        )}

        {/* ── Step 2: Gmail ── */}
        {step === 2 && (
          <div className="flex flex-col">
            <h1 className="mb-2 text-[28px] font-bold tracking-tight">
              Connect Gmail
            </h1>
            <p className="mb-8 text-[15px]" style={{ color: "#6B7280" }}>
              Aria reads your inbox so you can reply to clients without leaving the app.
            </p>

            {gmailConnected ? (
              <div
                className="mb-4 flex items-center gap-3 rounded-[14px] px-4 py-4"
                style={{ background: "rgba(16,185,129,0.10)", border: "0.5px solid rgba(16,185,129,0.25)" }}
              >
                <span style={{ color: "#10B981", fontSize: 20 }}>✓</span>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "#10B981" }}>Gmail connected</p>
                  <p className="text-[12px]" style={{ color: "#6B7280" }}>Your inbox is synced</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGmailConnect}
                className="flex w-full items-center justify-center gap-3 rounded-[14px] py-4 text-[16px] font-semibold text-white active:opacity-80"
                style={{
                  background: "rgba(20,20,22,0.6)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                }}
              >
                {/* Google G icon */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect with Google
              </button>
            )}

            <button
              type="button"
              onClick={() => setStep(3)}
              className="mt-4 w-full rounded-full py-4 text-[16px] font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #3B82F6, #06B6D4)" }}
            >
              Continue →
            </button>

            <SkipButton onClick={() => setStep(3)} />
          </div>
        )}

        {/* ── Step 3: Import clients ── */}
        {step === 3 && (
          <div className="flex flex-col">
            {csvSubStep === "upload" && (
              <>
                <h1 className="mb-2 text-[28px] font-bold tracking-tight">
                  Import your clients
                </h1>
                <p className="mb-8 text-[15px]" style={{ color: "#6B7280" }}>
                  Upload a CSV from your old CRM. Aria will map the columns automatically.
                </p>
                <UploadStep onFile={handleFile} />
                <SkipButton onClick={() => setStep(4)} />
              </>
            )}

            {csvSubStep === "mapping" && csv && (
              <MappingStep
                mapping={mapping}
                filename={filename}
                rowCount={csv.rows.length}
                onUpdateMapping={setMapping}
                onBack={() => setCsvSubStep("upload")}
                onContinue={handleMappingContinue}
                loading={mappingLoading}
              />
            )}

            {csvSubStep === "preview" && (
              <>
                <PreviewStep
                  rows={previewRows}
                  onUpdateRows={setPreviewRows}
                  onBack={() => setCsvSubStep("mapping")}
                  onImport={() => void handleImport()}
                  importing={importing}
                />
                {importError && (
                  <p className="mt-3 text-center text-[13px]" style={{ color: "#EF4444" }}>
                    {importError}
                  </p>
                )}
              </>
            )}

            {csvSubStep === "done" && importResult && (
              <div className="flex flex-col items-center text-center pt-8">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-[28px]"
                  style={{ background: "rgba(16,185,129,0.12)" }}
                >
                  ✓
                </div>
                <h2 className="mb-1 text-[22px] font-bold">
                  {importResult.inserted} client{importResult.inserted !== 1 ? "s" : ""} imported
                </h2>
                {importResult.skipped > 0 && (
                  <p className="mb-6 text-[13px]" style={{ color: "#6B7280" }}>
                    {importResult.skipped} row{importResult.skipped !== 1 ? "s" : ""} skipped
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #06B6D4)" }}
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Finish ── */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center pt-8">
            {/* Aria orb */}
            <div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: "radial-gradient(circle at 38% 35%, #8aacff, #3a65f0 55%, #2a48cc)",
                boxShadow: "0 0 0 1px rgba(58,101,240,0.25), 0 20px 80px rgba(58,101,240,0.4)",
              }}
            >
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
                <defs>
                  <linearGradient id="finish-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.70)" />
                  </linearGradient>
                </defs>
                <path d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z" fill="url(#finish-grad)" />
              </svg>
            </div>

            <h1 className="mb-3 text-[28px] font-bold tracking-tight">
              You&apos;re all set
            </h1>
            <p className="mb-10 text-[15px] leading-relaxed" style={{ color: "#6B7280" }}>
              Aria will surface who to follow up with, draft your texts, and keep you on top of every deal.
            </p>

            <button
              type="button"
              onClick={() => void finish()}
              className="w-full rounded-full py-4 text-[16px] font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #3B82F6, #06B6D4)" }}
            >
              Open Aria →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
