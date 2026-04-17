"use client";

import { InboxActivityCard } from "@/components/InboxActivityCard";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  ai_draft: boolean | null;
  approved: boolean | null;
  sent: boolean | null;
  client_id: string;
  clients: { name: string | null; phone: string | null } | null;
};

const filters = [
  "All",
  "AI Drafts",
  "Sent Texts",
  "Calls",
  "Notes",
  "Showings",
] as const;

export function InboxClient({
  initial,
  unread,
}: {
  initial: Row[];
  unread: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [rows] = useState(initial);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/inbox/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { updated?: number };
      if ((data.updated ?? 0) > 0) router.refresh();
    })();
  }, [router]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "All") return true;
      if (filter === "AI Drafts") return r.ai_draft && !r.approved;
      if (filter === "Sent Texts") return r.type === "text" && r.sent;
      if (filter === "Calls") return r.type === "call";
      if (filter === "Notes") return r.type === "note";
      if (filter === "Showings") return r.type === "showing";
      return true;
    });
  }, [rows, filter]);

  async function approveAll() {
    const drafts = rows.filter((r) => r.ai_draft && !r.approved && r.body);
    for (const r of drafts) {
      const phone = r.clients?.phone;
      if (!phone || !r.body) continue;
      await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: r.id,
          clientId: r.client_id,
          to: phone,
          body: r.body,
        }),
      });
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <header className="flex items-center justify-between gap-2">
        <div className="text-[20px] font-medium text-text-primary">Inbox</div>
        <span className="rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-[11px] font-medium text-accent-blue">
          {unread}
        </span>
      </header>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              filter === f
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filter === "AI Drafts" ? (
        <button
          type="button"
          onClick={approveAll}
          className="mt-3 w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
        >
          Approve All
        </button>
      ) : null}

      <div className="mt-4 space-y-3">
        {filtered.map((r) => (
          <InboxActivityCard
            key={r.id}
            id={r.id}
            type={r.type}
            body={r.body}
            created_at={r.created_at}
            clientName={r.clients?.name ?? "Client"}
            ai_draft={!!r.ai_draft}
            approved={!!r.approved}
            sent={!!r.sent}
            clientId={r.client_id}
            clientPhone={r.clients?.phone}
          />
        ))}
        {!filtered.length ? (
          <div className="rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
            No items in this filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
