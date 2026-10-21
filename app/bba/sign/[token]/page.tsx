"use client";

import SignatureCanvas from "react-signature-canvas";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Check,
  Download,
  Eraser,
  FileSignature,
  ShieldCheck,
} from "lucide-react";

// pdfjs imports WebWorker + canvas APIs — SSR would crash.
const BbaPdfViewer = dynamic(
  () => import("@/components/BbaPdfViewer").then((m) => m.BbaPdfViewer),
  { ssr: false, loading: () => <PdfLoading /> },
);

function PdfLoading() {
  return (
    <div className="rounded-[14px] border-[0.5px] border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
      Loading agreement PDF…
    </div>
  );
}

type Loaded = {
  client: { name: string };
  agent: { name: string };
  /** Set by the agent; the buyer can only read them. */
  terms: {
    commission_pct: number;
    term_start: string;
    term_end: string;
    search_area: string | null;
  };
  expires_at: string;
  bba: {
    signed_at: string;
    commission_pct: number;
    term_start: string;
    term_end: string;
  } | null;
  signed_pdf_url: string | null;
  template: {
    id: string;
    name: string;
    is_default: boolean;
    url: string | null;
  } | null;
};

export default function SignBbaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfWidth, setPdfWidth] = useState(540);

  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ signedPdfUrl: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/bba/sign/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as Loaded | { error: string };
        if (!res.ok || "error" in json) {
          setError(("error" in json && json.error) || "Not found");
          setLoading(false);
          return;
        }
        setData(json);
        setClientName(json.client.name);
        setLoading(false);
      } catch {
        setError("Network error");
        setLoading(false);
      }
    })();
  }, [token]);

  // Track container width for PDF rendering.
  useEffect(() => {
    function measure() {
      const el = document.getElementById("bba-pdf-wrap");
      if (el) setPdfWidth(Math.min(el.clientWidth, 720));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [data]);

  // Keep signature canvas sized to its wrapper (mobile-friendly).
  useEffect(() => {
    function resize() {
      const el = wrapRef.current;
      const canvas = sigRef.current?.getCanvas();
      if (!el || !canvas) return;
      const width = el.clientWidth;
      const height = 200;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [data, done]);

  function clear() {
    sigRef.current?.clear();
  }

  async function submit() {
    if (!token) return;
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Please draw your signature to continue.");
      return;
    }
    if (!clientName.trim()) {
      setError("Please enter your full legal name.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const signatureData = pad.getCanvas().toDataURL("image/png");
      const res = await fetch(`/api/bba/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, signatureData }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(String(json.error ?? "Could not save"));
      } else {
        setDone({ signedPdfUrl: json.signed_pdf_url ?? null });
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <p className="text-[13px] text-muted-foreground">Loading agreement…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <div className="max-w-sm rounded-[18px] border-[0.5px] border-border bg-card p-6 text-center">
          <p className="text-[14px] text-destructive mb-1">{error}</p>
          <p className="text-[12px] text-muted-foreground">
            Please contact your agent to resend the signing link.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-[22px] border-[0.5px] border-primary/30 bg-primary/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground mb-1">
            Agreement signed
          </h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Thanks, {clientName.split(" ")[0] || "there"}. Your Buyer Broker
            Agreement has been sent to {data?.agent.name ?? "your agent"}. A
            copy is saved on file.
          </p>
          {done.signedPdfUrl ? (
            <a
              href={done.signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground"
            >
              <Download size={14} /> Download signed PDF
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const already = data?.bba;
  const terms = data?.terms;
  const agentName = data?.agent.name ?? "Agent";
  const templateUrl = data?.template?.url ?? null;
  const templateName = data?.template?.name ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <div className="mx-auto w-full max-w-lg px-5 pt-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.2px] text-primary">
          <FileSignature size={14} /> NJ Buyer Broker Agreement
        </div>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight text-foreground">
          Sign to continue your home search
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Required by NAR settlement rules before any property showing.
        </p>

        {already ? (
          <div className="mt-5 rounded-[18px] border-[0.5px] border-primary/30 bg-primary/10 p-4 text-[13px] text-primary">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} /> Already signed
            </div>
            <p className="mt-1 text-[12px] text-primary">
              Signed{" "}
              {new Date(already.signed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {already.commission_pct}% · term {already.term_start} →{" "}
              {already.term_end}
            </p>
            {data?.signed_pdf_url ? (
              <a
                href={data.signed_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-primary/30 px-2.5 py-1 text-[11px] text-primary"
              >
                <Download size={12} /> Download signed copy
              </a>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Re-signing below will replace the current agreement.
            </p>
          </div>
        ) : null}

        {/* Template PDF preview, if the agent has uploaded one. */}
        {templateUrl ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-primary">
                {templateName ?? "Your agent's BBA"}
              </p>
              <a
                href={templateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              >
                <Download size={11} /> Open full-screen
              </a>
            </div>
            <div
              id="bba-pdf-wrap"
              className="rounded-[14px] border-[0.5px] border-border bg-background p-2"
            >
              <BbaPdfViewer url={templateUrl} width={pdfWidth - 16} />
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[18px] border-[0.5px] border-border bg-card p-4 text-[12.5px] leading-[1.55] text-muted-foreground">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px] text-primary">
              Agreement summary
            </p>
            <p>
              <span className="text-foreground">
                {clientName || "Client"}
              </span>{" "}
              (&ldquo;Buyer&rdquo;) engages{" "}
              <span className="text-foreground">{agentName}</span>{" "}
              as exclusive buyer-representative for the purchase of residential
              real property in{" "}
              <span className="text-foreground">
                {terms?.search_area || "New Jersey"}
              </span>
              . Buyer agrees to a broker compensation of{" "}
              <span className="text-foreground">{terms?.commission_pct}%</span> of
              the gross purchase price, payable at closing, for the term{" "}
              <span className="text-foreground">{terms?.term_start}</span> through{" "}
              <span className="text-foreground">{terms?.term_end}</span>. Agent
              agrees to represent Buyer&apos;s interests with undivided loyalty,
              full disclosure, and confidentiality as required by New Jersey
              real estate law and the REALTOR® Code of Ethics.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              This is Aria&apos;s generic agreement summary. Your agent can
              upload their brokerage&apos;s custom PDF in Settings — it will
              appear here on the next signing link.
            </p>
          </div>
        )}

        {/* Terms are set by the agent and can't be changed here. */}
        <div className="mt-5 rounded-[14px] border-[0.5px] border-border bg-card px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
            Terms set by your agent
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <ReadOnly label="Agent" value={agentName} />
            <ReadOnly label="Commission" value={terms ? `${terms.commission_pct}%` : "—"} />
            <ReadOnly label="Term start" value={terms?.term_start ?? "—"} />
            <ReadOnly label="Term end" value={terms?.term_end ?? "—"} />
            <ReadOnly label="Search area" value={terms?.search_area || "New Jersey"} />
            <ReadOnly
              label="Link expires"
              value={
                data
                  ? new Date(data.expires_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
              }
            />
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            If anything here looks wrong, ask {agentName} for a new link
            before signing.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <Field label="Your full legal name">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-[10px] border border-input bg-background px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary/40"
              autoComplete="name"
            />
          </Field>
        </div>

        {/* Signature pad */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
              Sign here
            </p>
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-[11px] text-primary"
            >
              <Eraser size={12} /> Clear
            </button>
          </div>
          <div
            ref={wrapRef}
            className="mt-2 rounded-[14px] border-[0.5px] border-input bg-paper touch-none"
          >
            <SignatureCanvas
              ref={sigRef}
              penColor="#111"
              backgroundColor="#ffffff"
              canvasProps={{
                className: "rounded-[14px]",
                style: { width: "100%", height: 200 },
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            By signing above, you acknowledge you&apos;ve read and agree to the
            Buyer Broker Agreement shown above. Your signature will be embedded
            onto the last page of the PDF.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-[12px] border-[0.5px] border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[12.5px] text-destructive">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-5 w-full rounded-[14px] bg-primary py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Sign & submit"}
        </button>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Powered by Aria · NJ Buyer Broker compliance
        </p>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
