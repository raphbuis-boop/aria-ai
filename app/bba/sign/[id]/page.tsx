"use client";

import SignatureCanvas from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, Eraser, FileSignature, ShieldCheck } from "lucide-react";

type Loaded = {
  client: { id: string; name: string };
  agent: { name: string };
  bba: {
    signed_at: string;
    commission_pct: number;
    term_start: string;
    term_end: string;
    search_area: string | null;
    agent_name: string;
    client_name: string;
  } | null;
};

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SignBbaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params?.id;
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const [form, setForm] = useState({
    clientName: "",
    agentName: "",
    commissionPct: "2.5",
    termStart: toYmd(today),
    termEnd: toYmd(addMonths(today, 6)),
    searchArea: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const res = await fetch(`/api/bba/${clientId}`, { cache: "no-store" });
        const json = (await res.json()) as Loaded | { error: string };
        if (!res.ok || "error" in json) {
          setError(("error" in json && json.error) || "Not found");
          setLoading(false);
          return;
        }
        setData(json);
        setForm((f) => ({
          ...f,
          clientName: json.client.name,
          agentName: json.agent.name,
        }));
        setLoading(false);
      } catch {
        setError("Network error");
        setLoading(false);
      }
    })();
  }, [clientId]);

  // Keep canvas sized to its wrapper so it works on mobile.
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
    if (!clientId) return;
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Please draw your signature to continue.");
      return;
    }
    if (!form.clientName.trim()) {
      setError("Please enter your full legal name.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const signatureData = pad.getCanvas().toDataURL("image/png");
      const res = await fetch(`/api/bba/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName,
          agentName: form.agentName,
          commissionPct: Number(form.commissionPct || 2.5),
          termStart: form.termStart,
          termEnd: form.termEnd,
          searchArea: form.searchArea,
          signatureData,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(String(json.error ?? "Could not save"));
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] flex items-center justify-center px-5">
        <p className="text-[13px] text-[#888898]">Loading agreement…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] flex items-center justify-center px-5">
        <div className="max-w-sm rounded-[18px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] p-6 text-center">
          <p className="text-[14px] text-[#ff6060] mb-1">{error}</p>
          <p className="text-[12px] text-[#666680]">
            Please contact your agent to resend the signing link.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-[22px] border-[0.5px] border-[#1a2a1a] bg-[#0f1a10] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#50dc78]/15 text-[#50dc78]">
            <Check size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-[20px] font-semibold text-[#f0eee8] mb-1">
            Agreement signed
          </h1>
          <p className="text-[13px] text-[#9090a8] mb-6">
            Thanks, {form.clientName.split(" ")[0] || "there"}. Your Buyer Broker
            Agreement has been sent to {form.agentName}. A copy is saved on
            file.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/clients/${clientId}`)}
            className="w-full rounded-[12px] border-[0.5px] border-[#2a2a3e] py-2.5 text-[13px] font-semibold text-[#9090a8]"
          >
            Return
          </button>
        </div>
      </div>
    );
  }

  const already = data?.bba;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] pb-10">
      <div className="mx-auto w-full max-w-lg px-5 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="mb-4 inline-flex items-center gap-1 text-[#4f7bff] text-sm font-semibold"
        >
          <ChevronLeft size={18} strokeWidth={2.5} className="-ml-1" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#4f7bff]">
          <FileSignature size={14} /> NJ Buyer Broker Agreement
        </div>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight text-[#f0eee8]">
          Sign to continue your home search
        </h1>
        <p className="mt-1 text-[13px] text-[#888898]">
          Required by NAR settlement rules before any property showing.
        </p>

        {already ? (
          <div className="mt-5 rounded-[18px] border-[0.5px] border-[#1a2a1a] bg-[#0f1a10] p-4 text-[13px] text-[#50dc78]">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} /> Already signed
            </div>
            <p className="mt-1 text-[12px] text-[#7aa489]">
              Signed{" "}
              {new Date(already.signed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {already.commission_pct}% · term {already.term_start} →{" "}
              {already.term_end}
            </p>
            <p className="mt-3 text-[11px] text-[#9090a8]">
              Re-signing below will replace the current agreement.
            </p>
          </div>
        ) : null}

        {/* Agreement text — compact NJ-style summary */}
        <div className="mt-5 rounded-[18px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] p-4 text-[12.5px] leading-[1.55] text-[#b6b6c8]">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#4f7bff]">
            Agreement summary
          </p>
          <p>
            <span className="text-[#f0eee8]">{form.clientName || "Client"}</span>{" "}
            (“Buyer”) engages{" "}
            <span className="text-[#f0eee8]">{form.agentName || "Agent"}</span>{" "}
            as exclusive buyer-representative for the purchase of residential
            real property in{" "}
            <span className="text-[#f0eee8]">
              {form.searchArea || "New Jersey"}
            </span>
            . Buyer agrees to a broker compensation of{" "}
            <span className="text-[#f0eee8]">{form.commissionPct}%</span> of the
            gross purchase price, payable at closing, for the term{" "}
            <span className="text-[#f0eee8]">{form.termStart}</span> through{" "}
            <span className="text-[#f0eee8]">{form.termEnd}</span>. Agent agrees
            to represent Buyer&apos;s interests with undivided loyalty, full
            disclosure, and confidentiality as required by New Jersey real
            estate law and the REALTOR® Code of Ethics.
          </p>
          <p className="mt-2 text-[11px] text-[#666680]">
            This is a simplified electronic representation for demo purposes —
            the full NJ Buyer Broker Agreement will accompany the fully executed
            copy on file.
          </p>
        </div>

        {/* Editable fields */}
        <div className="mt-5 space-y-3">
          <Field label="Your full legal name">
            <input
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none focus:border-[#4f7bff]/40"
              autoComplete="name"
            />
          </Field>
          <Field label="Agent name">
            <input
              value={form.agentName}
              onChange={(e) => setForm({ ...form, agentName: e.target.value })}
              className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none focus:border-[#4f7bff]/40"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Commission %">
              <input
                inputMode="decimal"
                value={form.commissionPct}
                onChange={(e) =>
                  setForm({ ...form, commissionPct: e.target.value })
                }
                className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none focus:border-[#4f7bff]/40"
              />
            </Field>
            <Field label="Term start">
              <input
                type="date"
                value={form.termStart}
                onChange={(e) => setForm({ ...form, termStart: e.target.value })}
                className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none"
              />
            </Field>
            <Field label="Term end">
              <input
                type="date"
                value={form.termEnd}
                onChange={(e) => setForm({ ...form, termEnd: e.target.value })}
                className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none"
              />
            </Field>
          </div>
          <Field label="Search area">
            <input
              value={form.searchArea}
              onChange={(e) => setForm({ ...form, searchArea: e.target.value })}
              placeholder="e.g. Bergen County, Westfield, Ridgewood"
              className="w-full rounded-[10px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-2.5 text-[14px] text-[#f0eee8] outline-none focus:border-[#4f7bff]/40 placeholder:text-[#444460]"
            />
          </Field>
        </div>

        {/* Signature pad */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#444460]">
              Sign here
            </p>
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-[11px] text-[#6f9bff]"
            >
              <Eraser size={12} /> Clear
            </button>
          </div>
          <div
            ref={wrapRef}
            className="mt-2 rounded-[14px] border-[0.5px] border-[#2a2a3e] bg-white touch-none"
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
          <p className="mt-2 text-[11px] text-[#444460]">
            By signing above, you acknowledge you&apos;ve read and agree to the
            Buyer Broker Agreement summary above.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-[12px] border-[0.5px] border-red-500/30 bg-red-500/5 px-3 py-2.5 text-[12.5px] text-red-400">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-5 w-full rounded-[14px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Sign & submit"}
        </button>

        <p className="mt-4 text-center text-[10px] text-[#333350]">
          Powered by Aria · NJ Buyer Broker compliance
        </p>
      </div>
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
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[1.2px] text-[#444460]">
        {label}
      </span>
      {children}
    </label>
  );
}
