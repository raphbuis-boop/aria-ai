"use client";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { fmtMoney } from "@/lib/utils";
import type { MlsListingPayload } from "@/lib/simplyrets";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AVATAR_COLORS = [
  "bg-red-500/20 text-red-400",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-amber-500/20 text-amber-400",
];

function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function parseTownList(raw: unknown): string {
  const s = String(raw ?? "");
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.join(", ") || "—";
}

export function ClientDetail({
  client,
  activities,
}: {
  client: Record<string, unknown>;
  activities: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  files?: Record<string, unknown>[];
  showings?: Record<string, unknown>[];
  matches?: Record<string, unknown>[];
  mlsLive?: MlsListingPayload[];
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  const id = String(client.id ?? "");
  const name = String(client.name ?? "Client");
  const phone = (client.phone as string | null) ?? null;
  const email = (client.email as string | null) ?? null;
  const town = parseTownList(client.town);
  const status = (client.status as string | null) ?? null;
  const leadScore = Number(client.lead_score ?? 0);
  const budgetMin = (client.budget_min as number | null) ?? null;
  const budgetMax = (client.budget_max as number | null) ?? null;
  const beds = (client.beds_wanted as number | null) ?? null;
  const baths = (client.baths_wanted as number | null) ?? null;
  const notes = (client.notes as string | null) ?? null;

  const budgetDisplay =
    budgetMin != null || budgetMax != null
      ? `${fmtMoney(budgetMin)} – ${fmtMoney(budgetMax)}`
      : "—";

  async function aiText() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/ai/draft-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          clientName: name,
          scenario: "Friendly check-in",
        }),
      });
      toast.toast("Draft in Inbox", "success");
      router.push("/inbox");
    } catch {
      toast.toast("Could not draft message", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function logCall() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activities").insert({
      client_id: id,
      agent_id: user.id,
      type: "call",
      body: "Call logged",
      ai_draft: false,
      approved: true,
      sent: false,
    });
    toast.toast("Call logged", "success");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[#4f7bff] text-sm font-semibold mb-4"
        >
          ← Back
        </button>

        <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] border border-[#1e2a4e] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-lg font-bold flex-shrink-0 ${AVATAR_COLORS[0]}`}
            >
              {initialsOf(name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-white truncate">
                {name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {status ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md">
                    {status.replace("_", " ")}
                  </span>
                ) : null}
                {leadScore >= 7 ? (
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Budget", value: budgetDisplay },
              { label: "Town", value: town },
              { label: "Lead Score", value: `${leadScore} / 10` },
              {
                label: "Beds / Baths",
                value:
                  beds != null || baths != null
                    ? `${beds ?? "?"}bd / ${baths ?? "?"}ba`
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-black/30 rounded-xl p-3">
                <p className="text-[10px] text-[#444460] uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p className="text-sm font-semibold text-[#d0d0e0]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {phone || email ? (
          <div className="flex gap-2 mb-4">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex-1 text-center bg-[#12121e] border border-[#1e1e2e] rounded-xl py-2.5 text-sm font-medium text-[#d0d0e0] truncate"
              >
                {phone}
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="flex-1 text-center bg-[#12121e] border border-[#1e1e2e] rounded-xl py-2.5 text-sm font-medium text-[#d0d0e0] truncate"
              >
                {email}
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={aiText}
            disabled={busy}
            className="flex-1 text-center bg-[#4f7bff]/12 text-[#6f9bff] border border-[#4f7bff]/20 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            AI Text
          </button>
          <button
            type="button"
            onClick={logCall}
            className="flex-1 bg-green-500/12 text-green-400 border border-green-500/20 rounded-xl py-2.5 text-sm font-semibold"
          >
            Log Call
          </button>
          <Link
            href={`/showings?new=1&client=${id}`}
            className="flex-1 text-center bg-[#12121e] border border-[#1e1e2e] text-[#888898] rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center"
          >
            Log Showing
          </Link>
        </div>

        {notes ? (
          <>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] mb-2">
              Notes
            </p>
            <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4 mb-4">
              <p className="text-sm text-[#a0a0c0] leading-relaxed whitespace-pre-wrap">
                {notes}
              </p>
            </div>
          </>
        ) : null}

        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] mb-3">
          Activity
        </p>
        {activities.length === 0 ? (
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-6 text-center text-[#444460] text-sm">
            No activity yet
          </div>
        ) : (
          <div className="space-y-0">
            {activities.slice(0, 20).map((itemRaw, i) => {
              const item = itemRaw as Record<string, unknown>;
              const createdAt = item.created_at
                ? new Date(String(item.created_at))
                : null;
              const typeLabel = String(item.type ?? "").replace("_", " ");
              return (
                <div key={String(item.id)} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[#4f7bff] mt-1 flex-shrink-0" />
                    {i < activities.length - 1 ? (
                      <div className="w-px flex-1 bg-[#1e1e2e] mt-1" />
                    ) : null}
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className="text-sm font-semibold text-[#d0d0e0] capitalize">
                      {typeLabel || "activity"}
                    </p>
                    <p className="text-xs text-[#555570] mt-0.5">
                      {createdAt
                        ? createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                    {item.body ? (
                      <p className="text-xs text-[#888898] mt-1 leading-relaxed whitespace-pre-wrap">
                        {String(item.body)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
