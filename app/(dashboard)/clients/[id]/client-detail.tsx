"use client";

import { BackButton } from "@/components/BackButton";
import { EditClientModal } from "@/components/EditClientModal";
import { InboxSheet } from "@/components/InboxSheet";
import { fmtMoney } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string;
  type: string | null;
  body: string | null;
  ai_draft: boolean;
  approved: boolean;
  sent: boolean;
  created_at: string;
};

type ClientDetailProps = {
  client: Record<string, unknown>;
  recentActivities: Activity[];
  draftCount: number;
  lastDraftBody: string | null;
  openTaskCount: number;
  recentMatchCount: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function initialsOf(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function isHot(status: string | null, leadScore: number): boolean {
  return status === "showing" || leadScore >= 8;
}

function budgetDisplay(min: number | null, max: number | null): string {
  if (min == null && max == null) return "";
  if (min != null && max != null)
    return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (max != null) return `Up to ${fmtMoney(max)}`;
  return `From ${fmtMoney(min!)}`;
}

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

type DotColor = "green" | "amber" | "blue" | "gray";

function activityDot(a: Activity): DotColor {
  if (a.type === "text" && a.sent) return "green";
  if (a.type === "text" && a.ai_draft && !a.approved) return "amber";
  if (a.type === "call") return "blue";
  return "gray";
}

const DOT_COLORS: Record<DotColor, string> = {
  green: "#1a9b5e",
  amber: "#d97706",
  blue:  "#0a7cff",
  gray:  "#48484a",
};

function activityLabel(a: Activity): string {
  if (a.type === "text" && a.ai_draft && !a.approved) return "AI draft pending";
  if (a.type === "text" && a.sent) return "Text sent";
  if (a.type === "call") return "Call logged";
  if (a.type === "note") return "Note";
  return a.type ?? "Activity";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientDetail({
  client,
  recentActivities,
  draftCount,
  lastDraftBody,
  openTaskCount,
  recentMatchCount,
}: ClientDetailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [gmailThread, setGmailThread] = useState<{
    connected: boolean;
    snippet?: string;
    fromFirst?: string;
    messageCount?: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const id        = String(client.id ?? "");
  const name      = String(client.name ?? "Client");
  const status    = (client.status as string | null) ?? null;
  const leadScore = Number(client.lead_score ?? 0);
  const budgetMin = (client.budget_min as number | null) ?? null;
  const budgetMax = (client.budget_max as number | null) ?? null;
  const beds      = (client.beds_wanted as number | null) ?? null;
  const town      = (client.town as string | null) ?? null;

  const clientEmail = String(client.email ?? "");

  const budget    = budgetDisplay(budgetMin, budgetMax);
  const hot       = isHot(status, leadScore);
  const initial   = initialsOf(name);
  const townLabel = town?.split(",")[0]?.trim() ?? null;

  const subtitle  = [townLabel, budget].filter(Boolean).join(" · ");
  const buyerPill = beds != null ? `${beds}bd Buyer` : "Buyer";

  // Fetch Gmail thread preview for the inbox tile
  useEffect(() => {
    if (!clientEmail) {
      setGmailThread(null);
      return;
    }
    void fetch(`/api/gmail/threads?clientEmail=${encodeURIComponent(clientEmail)}`)
      .then((r) => r.json())
      .then((d: { connected: boolean; messages?: Array<{ from: string; snippet: string }>; totalThreads?: number }) => {
        if (!d.connected) {
          setGmailThread({ connected: false });
          return;
        }
        const msgs = d.messages ?? [];
        const last = msgs[msgs.length - 1];
        const fromFirst = last ? last.from.split(" ")[0].replace(/[",]/g, "") : undefined;
        setGmailThread({
          connected: true,
          snippet: last?.snippet,
          fromFirst,
          messageCount: msgs.length,
        });
      })
      .catch(() => setGmailThread(null));
  }, [clientEmail]);

  return (
    <div
      className="min-h-screen pb-28"
      style={{ background: "#000000", color: "#f0f0f5" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <BackButton />

        <div className="flex items-center gap-3">
          {/* Edit client */}
          <button
            type="button"
            aria-label="Edit client"
            onClick={() => setEditOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/5"
          >
            <Pencil size={18} style={{ color: "#8e8e93" }} />
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More options"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/5"
            >
              <MoreVertical size={18} style={{ color: "#8e8e93" }} />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-[14px] py-1"
                  style={{
                    background: "rgba(28,28,30,0.97)",
                    border: "0.5px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center px-4 py-3 text-left text-[14px] active:bg-white/5"
                    style={{ color: "#f0f0f5" }}
                  >
                    Archive client
                  </button>
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)" }} />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center px-4 py-3 text-left text-[14px] active:bg-white/5"
                    style={{ color: "#EF4444" }}
                  >
                    Delete client
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-5">
        {/* ── Profile ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col items-center pt-4">
          {/* Avatar */}
          <div
            className="mb-4 flex items-center justify-center rounded-full text-[34px] font-bold text-white"
            style={{
              width: 84,
              height: 84,
              background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
              boxShadow: "0 0 30px rgba(59,130,246,0.3)",
            }}
          >
            {initial}
          </div>

          {/* Name */}
          <h1
            className="mb-1 text-[22px] font-bold leading-tight tracking-[-0.02em]"
            style={{ color: "#ffffff" }}
          >
            {name}
          </h1>

          {/* Subtitle */}
          {subtitle ? (
            <p className="mb-3 text-[13px]" style={{ color: "#6B7280" }}>
              {subtitle}
            </p>
          ) : null}

          {/* Pills */}
          <div className="flex items-center gap-2">
            {hot && (
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
              >
                Hot
              </span>
            )}
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA" }}
            >
              {buyerPill}
            </span>
          </div>
        </div>

        {/* ── Bento grid ───────────────────────────────────────────────── */}
        <div
          className="mb-6"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 10,
          }}
        >
          {/* Inbox tile — spans 2 rows, left column */}
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="text-left active:opacity-80"
            style={{
              gridColumn: "1",
              gridRow: "1 / span 2",
              background: "rgba(20,20,22,0.7)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 180,
            }}
          >
            <div>
              <p
                className="text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.07em" }}
              >
                Inbox
              </p>

              {/* Gmail not connected */}
              {gmailThread?.connected === false && (
                <p className="mt-3 text-[12px] leading-snug" style={{ color: "#6B7280" }}>
                  Connect Gmail to see emails
                </p>
              )}

              {/* No email on file */}
              {gmailThread === null && !clientEmail && (
                <p className="mt-3 text-[12px] leading-snug" style={{ color: "#6B7280" }}>
                  No email on file
                </p>
              )}

              {/* Loading */}
              {gmailThread === null && clientEmail && (
                <div className="mt-3 h-4 w-4 animate-spin rounded-full"
                  style={{ border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "#3B82F6" }}
                />
              )}

              {/* Connected + has threads */}
              {gmailThread?.connected && (
                <>
                  <p
                    className="mt-3 text-[22px] font-bold leading-none"
                    style={{ color: gmailThread.messageCount ? "#ffffff" : "#48484a" }}
                  >
                    {gmailThread.messageCount ?? "—"}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
                    {gmailThread.messageCount === 1
                      ? "email"
                      : gmailThread.messageCount
                      ? "emails"
                      : "no emails"}
                  </p>
                </>
              )}
            </div>

            {gmailThread?.connected && gmailThread.snippet ? (
              <p
                className="mt-4 line-clamp-3 text-[12px] leading-[1.5]"
                style={{ color: "#9CA3AF" }}
              >
                {gmailThread.fromFirst ? `Last from ${gmailThread.fromFirst}: ` : ""}
                {gmailThread.snippet}
              </p>
            ) : gmailThread?.connected === false ? (
              <div className="mt-4">
                <Link
                  href="/settings"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[12px] font-semibold"
                  style={{ color: "#0a7cff" }}
                >
                  Go to Settings →
                </Link>
              </div>
            ) : draftCount > 0 ? (
              <p
                className="mt-4 line-clamp-3 text-[12px] leading-[1.5]"
                style={{ color: "#9CA3AF" }}
              >
                &ldquo;{lastDraftBody}&rdquo;
              </p>
            ) : null}
          </button>

          {/* Matches tile — top right */}
          <Link
            href={`/clients/${id}/matches`}
            className="active:opacity-80"
            style={{
              gridColumn: "2",
              gridRow: "1",
              background: "rgba(20,20,22,0.7)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 85,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.07em" }}
            >
              Matches
            </p>
            <div>
              <p
                className="text-[28px] font-bold leading-none"
                style={{ color: recentMatchCount > 0 ? "#1a9b5e" : "#48484a" }}
              >
                {recentMatchCount > 0 ? recentMatchCount : "—"}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
                {recentMatchCount === 1
                  ? "new today"
                  : recentMatchCount > 1
                  ? "new today"
                  : "no new"}
              </p>
            </div>
          </Link>

          {/* Tasks tile — bottom right */}
          <Link
            href={`/clients/${id}/tasks`}
            className="active:opacity-80"
            style={{
              gridColumn: "2",
              gridRow: "2",
              background: "rgba(20,20,22,0.7)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 85,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.07em" }}
            >
              Tasks
            </p>
            <div>
              <p
                className="text-[28px] font-bold leading-none"
                style={{ color: openTaskCount > 0 ? "#d97706" : "#48484a" }}
              >
                {openTaskCount > 0 ? openTaskCount : "—"}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
                {openTaskCount === 1
                  ? "open"
                  : openTaskCount > 1
                  ? "open"
                  : "all done"}
              </p>
            </div>
          </Link>
        </div>

        {/* ── Recent activity ───────────────────────────────────────────── */}
        {recentActivities.length > 0 && (
          <div className="mb-6">
            <p
              className="mb-3 text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.07em" }}
            >
              Recent Activity
            </p>
            <div
              style={{
                background: "rgba(20,20,22,0.7)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 18,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                overflow: "hidden",
              }}
            >
              {recentActivities.map((a, i) => {
                const dot   = activityDot(a);
                const label = activityLabel(a);
                const time  = relTime(a.created_at);

                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-3.5"
                    style={
                      i > 0
                        ? { borderTop: "0.5px solid rgba(255,255,255,0.06)" }
                        : {}
                    }
                  >
                    {/* Dot */}
                    <div
                      className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: DOT_COLORS[dot] }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className="text-[13px] font-medium capitalize"
                          style={{ color: "#e0e0e5" }}
                        >
                          {label}
                        </p>
                        {time ? (
                          <p
                            className="flex-shrink-0 text-[11px]"
                            style={{ color: "#6B7280" }}
                          >
                            {time}
                          </p>
                        ) : null}
                      </div>
                      {a.body ? (
                        <p
                          className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed"
                          style={{ color: "#9CA3AF" }}
                        >
                          {a.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              href={`/clients/${id}/activity`}
              className="mt-2 block text-center text-[12px] font-semibold"
              style={{ color: "#0a7cff" }}
            >
              View all activity →
            </Link>
          </div>
        )}
      </div>

      {inboxOpen && (
        <InboxSheet
          clientId={id}
          clientName={name}
          clientEmail={clientEmail}
          onClose={() => setInboxOpen(false)}
        />
      )}

      {editOpen && (
        <EditClientModal
          client={{
            id,
            name: (client.name as string | null) ?? null,
            phone: (client.phone as string | null) ?? null,
            email: (client.email as string | null) ?? null,
            status: (client.status as string | null) ?? null,
            budget_min: (client.budget_min as number | null) ?? null,
            budget_max: (client.budget_max as number | null) ?? null,
            town: (client.town as string | null) ?? null,
            beds_wanted: (client.beds_wanted as number | null) ?? null,
            baths_wanted: (client.baths_wanted as number | null) ?? null,
            lead_score: (client.lead_score as number | null) ?? null,
            notes: (client.notes as string | null) ?? null,
            client_role: (client.client_role as string | null) ?? null,
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
