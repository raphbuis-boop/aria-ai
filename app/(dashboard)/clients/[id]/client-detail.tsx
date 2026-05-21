"use client";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { AIDraftModal } from "@/components/AIDraftModal";
import { BackButton } from "@/components/BackButton";
import { BbaSection } from "@/components/BbaSection";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ContractsSection } from "@/components/ContractsSection";
import { DealHistorySection } from "@/components/DealHistorySection";
import { EditClientModal } from "@/components/EditClientModal";
import { EngagementPulse } from "@/components/EngagementPulse";
import { MatchingPreferencesSection } from "@/components/MatchingPreferencesSection";
import { NextActionsSection } from "@/components/NextActionsSection";
import { fmtMoney } from "@/lib/utils";
import type { MlsListingPayload } from "@/lib/simplyrets";
import { CalendarPlus, Home, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BbaRow = {
  signed_at: string;
  commission_pct: number;
  term_start: string;
  term_end: string;
  search_area: string | null;
  agent_name: string;
  client_name: string;
} | null;

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

function formatBedsBaths(beds: number | null, baths: number | null): string {
  if (beds == null && baths == null) return "—";
  const b = beds != null ? `${beds}bd` : null;
  const ba = baths != null ? `${baths}ba` : null;
  return [b, ba].filter(Boolean).join(" / ");
}

function parseTownList(raw: unknown): string {
  const s = String(raw ?? "");
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.join(", ") || "—";
}

function bbaSummary(bba: BbaRow): string | null {
  if (!bba) return "Not signed";
  try {
    const d = new Date(bba.signed_at);
    return `Signed ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${bba.commission_pct}%`;
  } catch {
    return `Signed · ${bba.commission_pct}%`;
  }
}

function matchesSummary(matches: Record<string, unknown>[]): string | null {
  if (!matches.length) return null;
  const top = Number((matches[0] as Record<string, unknown>).match_score ?? 0);
  return `${matches.length} match${matches.length === 1 ? "" : "es"} · top ${top}%`;
}

export function ClientDetail({
  client,
  activities,
  tasks = [],
  showings = [],
  matches = [],
  bba,
}: {
  client: Record<string, unknown>;
  activities: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  files?: Record<string, unknown>[];
  showings?: Record<string, unknown>[];
  matches?: Record<string, unknown>[];
  mlsLive?: MlsListingPayload[];
  bba?: BbaRow;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftPrefill, setDraftPrefill] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [matchesExpanded, setMatchesExpanded] = useState(false);

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
    <div className="min-h-screen bg-[#080910] text-white pb-24">
      <div className="px-5 pt-6">
        {/* ─── Client Header ──────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <BackButton href="/clients" />
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[12px] border-[0.5px] border-[#1e2230] bg-[#12121e] px-3 py-2.5 text-[12px] font-semibold text-[#9090a8] active:border-[#3a65f0]"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-[#1e2a4e] bg-gradient-to-br from-[#0e1428] to-[#111230] p-5">
          <div className="mb-4 flex items-center gap-4">
            <div
              className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] text-lg font-bold ${AVATAR_COLORS[0]}`}
            >
              {initialsOf(name)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-white">
                {name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                {status ? (
                  <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                    {status.replace("_", " ")}
                  </span>
                ) : null}
                {leadScore >= 7 ? (
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { label: "Budget", value: budgetDisplay },
              { label: "Town", value: town },
              { label: "Lead Score", value: `${leadScore} / 10` },
              { label: "Beds / Baths", value: formatBedsBaths(beds, baths) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-black/30 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[#6b7090]">
                  {label}
                </p>
                <p className="text-sm font-semibold text-[#e8eaf2]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Engagement Pulse ───────────────────────────────────────── */}
        <EngagementPulse activities={activities} />

        {/* ─── Next Actions ───────────────────────────────────────────── */}
        <NextActionsSection
          clientId={id}
          initialTasks={tasks}
          activities={activities}
          showings={showings}
        />

        {phone || email ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex-1 truncate rounded-xl border border-[#1e2230] bg-[#12121e] py-2.5 text-center text-sm font-medium text-[#e8eaf2]"
              >
                {phone}
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="flex-1 truncate rounded-xl border border-[#1e2230] bg-[#12121e] py-2.5 text-center text-sm font-medium text-[#e8eaf2]"
              >
                {email}
              </a>
            ) : null}
          </div>
        ) : null}

        {/* ─── Quick Actions ──────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDraftOpen(true)}
            className="flex-1 rounded-xl border border-[#3a65f0]/20 bg-[#3a65f0]/12 py-2.5 text-center text-sm font-semibold text-[#6b8fff]"
          >
            AI Text
          </button>
          <button
            type="button"
            onClick={logCall}
            className="flex-1 rounded-xl border border-green-500/20 bg-green-500/12 py-2.5 text-sm font-semibold text-green-400"
          >
            Log Call
          </button>
          <Link
            href={`/showings?new=1&client=${id}`}
            className="flex flex-1 items-center justify-center rounded-xl border border-[#1e2230] bg-[#12121e] py-2.5 text-center text-xs font-semibold text-[#9498b0]"
          >
            Log Showing
          </Link>
        </div>

        {/* ─── BBA Status ─────────────────────────────────────────────── */}
        <CollapsibleSection
          title="Buyer Broker Agreement"
          summary={bbaSummary(bba ?? null)}
        >
          <BbaSection
            clientId={id}
            clientName={name}
            clientPhone={phone}
            initialBba={bba ?? null}
          />
        </CollapsibleSection>

        {/* ─── Deal History ───────────────────────────────────────────── */}
        <DealHistorySection clientId={id} />

        {/* ─── Contracts & Documents ──────────────────────────────────── */}
        <ContractsSection clientId={id} />

        {/* ─── Property Matches ───────────────────────────────────────── */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b7090]">
                Property Matches
              </p>
              {matches.length > 0 && (
                <span className="rounded-full bg-[#3a65f0]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#6b8fff]">
                  {matches.length}
                </span>
              )}
            </div>
            {matches.length > 0 && (
              <p className="text-[11px] text-[#555570]">
                {matchesSummary(matches)}
              </p>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2a2e40] bg-[#12121e] px-4 py-6 text-center text-[12.5px] text-[#9498b0]">
              No matches yet.{" "}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("matching-prefs");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="font-semibold text-[#6b8fff] underline-offset-2 hover:underline"
              >
                Update Matching Preferences →
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {matches
                  .slice(0, matchesExpanded ? matches.length : 3)
                  .map((mRaw) => {
                    const m = mRaw as Record<string, unknown>;
                    const p = (m.properties ?? {}) as Record<string, unknown>;
                    const score = Number(m.match_score ?? 0);
                    const propertyId = String(p.id ?? "");
                    const address = String(p.address ?? "—");

                    // "New" badge — within 7 days
                    const listedDate = p.listed_date
                      ? new Date(String(p.listed_date))
                      : null;
                    const isNew =
                      listedDate != null &&
                      Date.now() - listedDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

                    return (
                      <li
                        key={String(m.id)}
                        className="rounded-2xl border border-[#1e2230] bg-[#12121e] px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#3a65f0]/12 text-[#6b8fff]">
                            <Home size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-semibold text-[#e8eaf2]">
                                {address}
                              </p>
                              {isNew && (
                                <span className="flex-shrink-0 rounded-md bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#555570]">
                              {String(p.town ?? "—")}
                              {p.price != null
                                ? ` · ${fmtMoney(Number(p.price))}`
                                : ""}
                              {p.beds != null ? ` · ${p.beds}bd` : ""}
                              {p.baths != null ? ` / ${p.baths}ba` : ""}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <span className="rounded-md bg-[#3a65f0]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6b8fff]">
                              {score}%
                            </span>
                            {propertyId ? (
                              <Link
                                href={`/properties/${propertyId}`}
                                className="text-[11px] font-semibold text-[#6b8fff]"
                              >
                                View
                              </Link>
                            ) : null}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-2.5 flex flex-wrap gap-2 pl-12">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftPrefill(address);
                              setDraftOpen(true);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-[#3a65f0]/20 bg-[#3a65f0]/10 px-3 py-2 text-[11px] font-semibold text-[#6b8fff]"
                          >
                            <Send size={12} />
                            Send to client
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toast.toast("Schedule showing — coming soon", "default")
                            }
                            className="flex items-center gap-1 rounded-lg border border-[#1e2230] bg-[#0e0e1a] px-3 py-2 text-[11px] font-semibold text-[#9498b0]"
                          >
                            <CalendarPlus size={12} />
                            Schedule showing
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>

              {matches.length > 3 && (
                <button
                  type="button"
                  onClick={() => setMatchesExpanded((p) => !p)}
                  className="mt-2 w-full rounded-xl border border-[#1e2230] bg-[#0e0e1a] py-2 text-center text-[12px] font-semibold text-[#6b8fff]"
                >
                  {matchesExpanded
                    ? "Show less"
                    : `+ ${matches.length - 3} more match${matches.length - 3 === 1 ? "" : "es"}`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ─── Matching Preferences ───────────────────────────────────── */}
        <div id="matching-prefs">
        <CollapsibleSection title="Matching Preferences" defaultOpen={false}>
          <MatchingPreferencesSection
            clientId={id}
            initial={client}
            primaryTown={(client.town as string | null) ?? null}
          />
        </CollapsibleSection>
        </div>

        {/* ─── Notes (inline, only if present) ────────────────────────── */}
        {notes ? (
          <CollapsibleSection title="Notes">
            <div className="rounded-2xl border border-[#1e2230] bg-[#12121e] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#a0a0c0]">
                {notes}
              </p>
            </div>
          </CollapsibleSection>
        ) : null}

        {/* ─── Activity Timeline ──────────────────────────────────────── */}
        <CollapsibleSection
          title="Activity"
          summary={
            activities.length
              ? `${activities.length} item${activities.length === 1 ? "" : "s"}`
              : null
          }
        >
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-[#1e2230] bg-[#12121e] p-6 text-center text-sm text-[#6b7090]">
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
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#3a65f0]" />
                      {i < activities.length - 1 ? (
                        <div className="mt-1 w-px flex-1 bg-[#1e2230]" />
                      ) : null}
                    </div>
                    <div className="min-w-0 pb-2">
                      <p className="text-sm font-semibold capitalize text-[#e8eaf2]">
                        {typeLabel || "activity"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#555570]">
                        {createdAt
                          ? createdAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </p>
                      {item.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#9498b0]">
                          {String(item.body)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>
      </div>

      {draftOpen ? (
        <AIDraftModal
          client={{
            id,
            name,
            phone,
            town: town === "—" ? null : town,
            budget_max: budgetMax,
            status,
          }}
          propertyContext={draftPrefill ?? undefined}
          onClose={() => {
            setDraftOpen(false);
            setDraftPrefill(null);
          }}
        />
      ) : null}

      {editOpen ? (
        <EditClientModal
          client={{
            id,
            name: (client.name as string | null) ?? null,
            phone,
            email,
            status,
            budget_min: budgetMin,
            budget_max: budgetMax,
            town: (client.town as string | null) ?? null,
            beds_wanted: beds,
            baths_wanted: baths,
            lead_score: leadScore,
            notes,
            client_role: (client.client_role as string | null) ?? null,
          }}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  );
}
