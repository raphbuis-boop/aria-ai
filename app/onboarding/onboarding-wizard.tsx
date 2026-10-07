"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { ImportGroupPicker, ImportSummary, type ImportOutcome } from "@/components/import/ImportSummary";
import { GoogleContactsImport } from "@/components/import/GoogleContactsImport";

/**
 * First run: name → Google → import clients → voice → Today.
 * Every step can be skipped; the goal is real clients and a real follow-up
 * on Today within a few minutes of signing up.
 */

export type WizardStep = 1 | 2 | 3 | 4 | 5;
type CsvSubStep = "upload" | "mapping" | "preview" | "done";
export type Tone = "warm" | "professional" | "direct" | "casual";

const TONES: { value: Tone; label: string; example: string }[] = [
  { value: "warm", label: "Warm & friendly", example: "Hi Dana! Hope your week's going well." },
  { value: "professional", label: "Professional", example: "Hi Dana, following up on the homes we discussed." },
  { value: "direct", label: "Direct", example: "Dana — 12 Oak Ln just listed. Want to see it Saturday?" },
  { value: "casual", label: "Casual", example: "Hey Dana! Saw a place you'd love, want the link?" },
];

const STEP_LABELS = ["You", "Google", "Clients", "Voice", "Done"] as const;

type Props = {
  userId: string;
  initialName: string;
  initialStep: WizardStep;
  googleConnected: boolean;
  googleError?: boolean;
  initialTone: Tone;
  initialSignature: string;
};

function Progress({ step }: { step: WizardStep }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-1.5" aria-label={`Step ${step} of ${STEP_LABELS.length}`}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        return (
          <li
            key={label}
            aria-current={n === step ? "step" : undefined}
            className={`h-1 rounded-full transition-all ${n === step ? "w-7 bg-primary" : n < step ? "w-2 bg-primary" : "w-2 bg-secondary"}`}
          >
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1 className="mb-2 font-heading text-[30px] leading-tight text-foreground">{title}</h1>
      <p className="mb-7 font-display text-body-lg text-muted-foreground">{body}</p>
    </>
  );
}

function Skip({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 w-full rounded-xl py-3 font-display text-body font-medium text-muted-foreground">
      {label}
    </button>
  );
}

const FIELD =
  "w-full rounded-xl border border-input bg-card px-4 py-3.5 font-display text-body-lg text-foreground outline-none placeholder:text-muted-foreground";

export function OnboardingWizard({ userId, initialName, initialStep, googleConnected, googleError, initialTone, initialSignature }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<WizardStep>(initialStep);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState(0);

  // Step 3 — import
  const [source, setSource] = useState<"google" | "csv">(googleConnected ? "google" : "csv");
  const [csvSubStep, setCsvSubStep] = useState<CsvSubStep>("upload");
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<FieldMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportOutcome | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [group, setGroup] = useState<"leads" | "sphere">("sphere");
  const [googleImportDone, setGoogleImportDone] = useState(false);

  // Step 4 — voice
  const [tone, setTone] = useState<Tone>(initialTone);
  const [signature, setSignature] = useState(initialSignature || (initialName.trim() ? `– ${initialName.trim().split(" ")[0]}` : ""));
  const [samples, setSamples] = useState(["", "", ""]);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed) {
      setSaving(true);
      await supabase.from("agent_profiles").upsert({ id: userId, full_name: trimmed });
      setSaving(false);
      if (!signature) setSignature(`– ${trimmed.split(" ")[0]}`);
    }
    setStep(googleConnected ? 3 : 2);
  }

  function connectGoogle() {
    // Tells the OAuth callback to come back here; the page then opens step 3.
    document.cookie = "aria_return_to=onboarding; path=/; max-age=600; SameSite=Lax";
    window.location.href = "/api/auth/google/connect";
  }

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
      const data = (await res.json()) as { mapping?: CsvMappingItem[] };
      const aiMapping: FieldMapping[] = (data.mapping ?? []).map((m) => ({
        header: m.header,
        field: m.field as FieldMapping["field"],
        confidence: m.confidence,
      }));
      const mapped = new Set(aiMapping.map((m) => m.header));
      for (const h of parsed.headers) if (!mapped.has(h)) aiMapping.push({ header: h, field: "skip", confidence: "low" });
      setMapping(aiMapping);
    } catch {
      setMapping(parsed.headers.map((h) => ({ header: h, field: "skip" as const, confidence: "low" as const })));
    } finally {
      setMappingLoading(false);
    }
    setCsvSubStep("mapping");
  }

  async function importCsv() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: buildImportPayload(previewRows), group }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportOutcome & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setCsvResult(data);
      setImported((n) => n + data.inserted);
      setCsvSubStep("done");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function saveVoice() {
    setSaving(true);
    try {
      await fetch("/api/settings/drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftTone: tone, signature }),
      });
      const real = samples.map((s) => s.trim()).filter(Boolean);
      if (real.length) {
        await supabase.from("agent_profiles").upsert({ id: userId, voice_samples: real });
        // Tone analysis takes a few seconds; don't hold the agent here for it.
        void fetch("/api/ai/analyze-tone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceSamples: real }),
        })
          .then((r) => r.json())
          .then((d: { analysis?: string }) =>
            d.analysis ? supabase.from("agent_profiles").update({ tone_analysis: d.analysis }).eq("id", userId) : null,
          )
          .catch(() => {});
      }
    } finally {
      setSaving(false);
      setStep(5);
    }
  }

  async function finish() {
    setSaving(true);
    await supabase.from("agent_profiles").upsert({ id: userId, onboarding_complete: true });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <main
        className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-6"
        style={{
          paddingTop: "max(3rem, calc(env(safe-area-inset-top) + 2rem))",
          paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))",
        }}
      >
        <p className="mb-6 text-center font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Aria</p>
        <Progress step={step} />

        {step === 1 ? (
          <section>
            <Heading
              title="Welcome to Aria"
              body="Aria tells you who to follow up with each day and drafts the text in your voice. You send it from your phone. About five minutes to set up."
            />
            <label htmlFor="onb-name" className="mb-1.5 block font-display text-caption font-semibold text-muted-foreground">
              Your name
            </label>
            <input
              id="onb-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName();
              }}
              placeholder="Full name"
              className={FIELD}
            />
            <Button onClick={() => void saveName()} disabled={saving} className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold">
              {saving ? "Saving…" : "Continue"}
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <Heading
              title="Connect Google"
              body="Bring in your contacts, see client email in one place, and check your calendar before booking a showing. Aria never sends anything without you."
            />
            {googleError ? (
              <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-display text-body text-danger">
                Google didn&apos;t connect. Try again, or skip and import a CSV instead.
              </p>
            ) : null}
            <Button onClick={connectGoogle} variant="outline" className="h-12 w-full gap-3 rounded-xl border-input bg-card text-body-lg font-semibold">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect with Google
            </Button>
            <Skip onClick={() => setStep(3)} />
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            {csvSubStep === "upload" ? (
              <>
                {googleImportDone ? null : (
                <>
                {googleConnected ? (
                  <p className="mb-4 flex items-center gap-2 font-display text-body font-semibold text-primary">
                    <Check className="size-4" /> Google connected
                  </p>
                ) : null}
                <Heading title="Bring in your clients" body="Pick the people you work with. Aria lines up who to text first." />
                <div role="tablist" aria-label="Import from" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
                  {(
                    [
                      ["google", "Google Contacts"],
                      ["csv", "CSV file"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={source === v}
                      onClick={() => setSource(v)}
                      className={`rounded-lg py-2 font-display text-caption font-semibold ${source === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                </>
                )}
                {source === "google" ? (
                  <GoogleContactsImport
                    returnTo="onboarding"
                    doneLabel="Continue"
                    onImported={() => setGoogleImportDone(true)}
                    onDone={(r) => {
                      setImported((n) => n + r.inserted);
                      setStep(4);
                    }}
                  />
                ) : (
                  <>
                    <p className="mb-3 font-display text-body text-muted-foreground">
                      Export a CSV from your old CRM or spreadsheet. Aria maps the columns for you.
                    </p>
                    <UploadStep onFile={handleFile} />
                  </>
                )}
                {googleImportDone ? null : <Skip onClick={() => setStep(4)} label="I'll add clients later" />}
              </>
            ) : null}

            {csvSubStep === "mapping" && csv ? (
              <MappingStep
                mapping={mapping}
                filename={filename}
                rowCount={csv.rows.length}
                onUpdateMapping={setMapping}
                onBack={() => setCsvSubStep("upload")}
                onContinue={() => {
                  setPreviewRows(buildPreviewRows(csv.headers, csv.rows, mapping));
                  setCsvSubStep("preview");
                }}
                loading={mappingLoading}
              />
            ) : null}

            {csvSubStep === "preview" ? (
              <>
                <div className="mb-5">
                  <ImportGroupPicker value={group} onChange={setGroup} />
                </div>
                <PreviewStep
                  rows={previewRows}
                  onUpdateRows={setPreviewRows}
                  onBack={() => setCsvSubStep("mapping")}
                  onImport={() => void importCsv()}
                  importing={importing}
                />
                {importError ? (
                  <p role="alert" className="mt-3 text-center font-display text-body text-danger">
                    {importError}
                  </p>
                ) : null}
              </>
            ) : null}

            {csvSubStep === "done" && csvResult ? (
              <>
                <ImportSummary result={csvResult} />
                <Button onClick={() => setStep(4)} className="mt-6 h-12 w-full rounded-xl text-body-lg font-semibold">
                  Continue
                </Button>
              </>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section>
            <Heading title="Sound like you" body="Aria writes every draft in your voice. You can change this anytime in Settings." />

            <fieldset className="mb-6">
              <legend className="mb-2 font-display text-body font-semibold text-foreground">Your texting style</legend>
              <div className="space-y-2">
                {TONES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${tone === t.value ? "border-primary bg-primary/5" : "border-input bg-card"}`}
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={t.value}
                      checked={tone === t.value}
                      onChange={() => setTone(t.value)}
                      className="mt-1 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block font-display text-body font-semibold text-foreground">{t.label}</span>
                      <span className="block font-display text-caption text-muted-foreground">&ldquo;{t.example}&rdquo;</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="onb-signature" className="mb-1.5 block font-display text-body font-semibold text-foreground">
              Sign-off
            </label>
            <input
              id="onb-signature"
              type="text"
              value={signature}
              maxLength={200}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="– Sarah, ABC Realty"
              className={FIELD}
            />

            <details className="mt-6 rounded-xl border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer font-display text-body font-semibold text-foreground">
                Paste a few texts you&apos;ve sent <span className="font-normal text-muted-foreground">(optional — sharpens your voice)</span>
              </summary>
              <div className="mt-3 space-y-2">
                {samples.map((s, i) => (
                  <textarea
                    key={i}
                    aria-label={`Sample text ${i + 1}`}
                    value={s}
                    rows={2}
                    onChange={(e) => setSamples((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={i === 0 ? "e.g. Hi Mark! The sellers accepted — congrats. Call you in 10." : "Another text you've sent"}
                    className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-display text-body text-foreground outline-none placeholder:text-muted-foreground"
                  />
                ))}
              </div>
            </details>

            <Button onClick={() => void saveVoice()} disabled={saving} className="mt-6 h-12 w-full rounded-xl text-body-lg font-semibold">
              {saving ? "Saving…" : "Continue"}
            </Button>
            <Skip onClick={() => setStep(5)} />
          </section>
        ) : null}

        {step === 5 ? (
          <section className="text-center">
            <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-7" />
            </span>
            <h1 className="mb-2 font-heading text-[30px] leading-tight text-foreground">You&apos;re set</h1>
            <p className="mb-8 font-display text-body-lg text-muted-foreground">
              {imported > 0
                ? `${imported} client${imported === 1 ? "" : "s"} in. Today shows who to text first — tap one, check Aria's draft, and send it from your phone.`
                : "Add or import clients anytime from the Clients tab. Today will show who to text first."}
            </p>
            <Button onClick={() => void finish()} disabled={saving} className="h-12 w-full rounded-xl text-body-lg font-semibold">
              {imported > 0 ? "See who to text today" : "Open Aria"}
            </Button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
