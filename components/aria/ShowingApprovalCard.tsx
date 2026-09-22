"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

export type ShowingRequestRow = {
  id: string;
  address: string | null;
  showing_date: string | null;
  requested_time_text: string | null;
  notes: string | null;
  created_at: string;
  client?: { id: string; name: string } | null;
};

/** ISO → value for <input type="datetime-local"> in the viewer's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * A client asked Aria for a showing. The agent picks/confirms the time and
 * approves (Aria texts the confirmation + BBA link) or declines.
 */
export function ShowingApprovalCard({ req }: { req: ShowingRequestRow }) {
  const router = useRouter();
  const [when, setWhen] = useState(toLocalInput(req.showing_date));
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const conflict = req.notes?.match(/Calendar conflict: [^.]*\./)?.[0] ?? null;

  async function act(kind: "approve" | "decline") {
    if (kind === "approve" && !when) {
      toast.error("Pick a date and time first");
      return;
    }
    setBusy(kind);
    try {
      const res = await fetch(`/api/showings/${req.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "approve"
            ? { showingDate: new Date(when).toISOString() }
            : { message: "Thanks for your patience — that time won't work. I'll follow up with another option shortly." },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      if (kind === "approve") {
        toast.success(
          json.confirmation?.ok
            ? json.bba?.skipped
              ? "Showing booked — confirmation texted"
              : "Showing booked — confirmation and BBA link texted"
            : `Showing booked, but the text failed: ${json.confirmation?.error ?? "unknown"}`,
        );
      } else {
        toast.success("Request declined");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CalendarClock className="size-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          {req.client ? (
            <Link
              href={`/clients/${req.client.id}`}
              className="font-display text-caption font-semibold uppercase tracking-[0.06em] text-primary"
            >
              {req.client.name} · showing request
            </Link>
          ) : null}
          <p className="font-display text-body font-semibold text-foreground">
            {req.address ?? "Home not specified"}
          </p>
          <p className="font-display text-caption text-muted-foreground">
            Asked for: {req.requested_time_text ?? "no time given"}
          </p>
          {conflict ? (
            <p className="mt-1 flex items-center gap-1.5 font-display text-caption text-[var(--hot)]">
              <AlertTriangle className="size-3.5" /> {conflict}
            </p>
          ) : null}
          <input
            type="datetime-local"
            aria-label="Showing date and time"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 font-display text-body"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => act("approve")} disabled={busy !== null}>
              {busy === "approve" ? "Booking…" : "Approve & text"}
            </Button>
            <Button variant="outline" onClick={() => act("decline")} disabled={busy !== null}>
              {busy === "decline" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
