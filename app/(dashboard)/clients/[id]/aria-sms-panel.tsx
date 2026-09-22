"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileSignature, Home as HomeIcon, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import {
  ShowingApprovalCard,
  type ShowingRequestRow,
} from "@/components/aria/ShowingApprovalCard";
import { fmtMoney } from "@/lib/utils";

export type { ShowingRequestRow };

export type SignedBba = {
  signed_at: string;
  commission_pct: number;
  term_start: string;
  term_end: string;
  search_area: string | null;
  signed_pdf_url: string | null;
} | null;

export type AriaThreadState = {
  phone: string | null;
  paused: boolean;
  optedOut: boolean;
  started: boolean;
};

export type MatchedHome = {
  id: string;
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  town: string | null;
  score: number;
  sentByAria: boolean;
};

export function ShowingRequests({ requests }: { requests: ShowingRequestRow[] }) {
  if (!requests.length) return null;
  return (
    <section className="mb-12">
      <p className="font-display text-section text-muted-foreground mb-3">Showing requests</p>
      <div className="space-y-3">
        {requests.map((r) => (
          <ShowingApprovalCard key={r.id} req={r} />
        ))}
      </div>
    </section>
  );
}

/** Aria's SMS thread controls: start, pause/resume, and reply from Aria's number. */
export function AriaThread({ clientId, firstName, state }: { clientId: string; firstName: string; state: AriaThreadState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  async function call(action: "start" | "pause" | "resume" | "send") {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/aria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? { action, body: text } : { action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.firstText?.error ?? "Request failed");
      if (action === "send") setText("");
      toast.success(
        { start: "Aria sent the first text", pause: "Aria paused", resume: "Aria is back on", send: "Sent" }[action],
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const status = !state.phone
    ? "No phone number on file."
    : state.optedOut
      ? `${firstName} texted STOP. Aria won't text them.`
      : !state.started
        ? "Aria hasn't texted this client yet."
        : state.paused
          ? "Paused — you're handling replies. Aria still logs their texts."
          : `Aria is texting ${firstName} and answering replies.`;

  return (
    <section className="mb-12">
      <p className="font-display text-section text-muted-foreground mb-3">Aria texting</p>
      <Card className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-body text-foreground">{status}</p>
            {state.phone && !state.optedOut ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {!state.started ? (
                  <Button size="sm" onClick={() => call("start")} disabled={busy}>
                    Start Aria texting
                  </Button>
                ) : state.paused ? (
                  <Button size="sm" onClick={() => call("resume")} disabled={busy}>
                    Resume Aria
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => call("pause")} disabled={busy}>
                    Pause Aria
                  </Button>
                )}
              </div>
            ) : null}
            {state.phone && !state.optedOut && state.started ? (
              <div className="mt-4">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  aria-label={`Text ${firstName} from Aria's number`}
                  placeholder={`Reply to ${firstName} yourself…`}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-display text-body"
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => call("send")}
                  disabled={busy || !text.trim()}
                >
                  Send from Aria&apos;s number
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </section>
  );
}

export function MatchedHomes({ homes }: { homes: MatchedHome[] }) {
  if (!homes.length) return null;
  return (
    <section className="mb-12">
      <p className="font-display text-section text-muted-foreground mb-3">Matched homes</p>
      <Card className="divide-y divide-border overflow-hidden">
        {homes.map((h) => (
          <div key={h.id} className="flex items-start gap-3 px-5 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <HomeIcon className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-body font-semibold text-foreground">
                {h.address ?? "Address unavailable"}
                {h.sentByAria ? (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 font-display text-[11px] font-semibold text-primary">
                    Sent by Aria
                  </span>
                ) : null}
              </p>
              <p className="font-display text-caption text-muted-foreground">
                {[h.price != null ? fmtMoney(h.price) : null, h.beds != null ? `${h.beds} bd` : null, h.baths != null ? `${h.baths} ba` : null, `${h.score}% match`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ))}
      </Card>
      <div className="mt-3">
        <IdxComplianceNotice compact />
      </div>
    </section>
  );
}

export function BbaStatus({ bba }: { bba: SignedBba }) {
  return (
    <section className="mb-12">
      <p className="font-display text-section text-muted-foreground mb-3">Buyer Broker Agreement</p>
      <Card className="px-5 py-4">
        {bba ? (
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-3.5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-body font-semibold text-foreground">
                Signed{" "}
                {new Date(bba.signed_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="font-display text-caption text-muted-foreground">
                {bba.commission_pct}% · {bba.term_start} → {bba.term_end}
                {bba.search_area ? ` · ${bba.search_area}` : ""}
              </p>
              {bba.signed_pdf_url && (
                <a
                  href={bba.signed_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-primary"
                >
                  <Download className="size-3.5" /> Signed PDF
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <FileSignature className="size-3.5 text-muted-foreground" />
            </span>
            <p className="font-display text-body text-muted-foreground">
              Not signed yet. Aria texts the signing link when you approve a showing.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
