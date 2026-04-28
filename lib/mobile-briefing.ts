import { differenceInCalendarDays } from "date-fns";

export type MobileClientRow = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone: string | null;
};

export type MobileTxRow = {
  id: string;
  client_id: string;
  address: string | null;
  closing_date: string | null;
  status: string | null;
};

export function isHotLead(c: MobileClientRow): boolean {
  return (
    c.status === "showing" ||
    c.status === "hot" ||
    (c.lead_score ?? 0) >= 8
  );
}

export function pipelineTotalCompact(
  clients: { budget_max: number | null }[],
): string {
  const total = clients.reduce((s, c) => s + (c.budget_max ?? 0), 0);
  if (total >= 1_000_000)
    return `$${(total / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (total >= 1_000) return `$${Math.round(total / 1_000)}k`;
  return `$${total}`;
}

export function buildMobileBriefing(
  clients: MobileClientRow[],
  transactions: MobileTxRow[],
  newMatches: number,
): string | null {
  const visible = clients;
  const hotLeads = visible.filter(
    (c) => isHotLead(c) && c.status !== "closed",
  );

  const now = Date.now();
  const nearestClosing = transactions
    .filter((t) => t.closing_date)
    .map((t) => ({
      t,
      days: differenceInCalendarDays(new Date(String(t.closing_date)), now),
    }))
    .filter((x) => x.days >= 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days)[0] ?? null;

  const parts: string[] = [];
  if (newMatches > 0) {
    parts.push(
      `${newMatches} new property match${newMatches === 1 ? "" : "es"} overnight`,
    );
  }
  if (hotLeads.length > 0) {
    parts.push(
      `${hotLeads.length} hot lead${hotLeads.length === 1 ? "" : "s"} need follow-up`,
    );
  }
  if (nearestClosing) {
    parts.push(
      nearestClosing.days === 0
        ? "closing today"
        : `1 closing in ${nearestClosing.days} day${nearestClosing.days === 1 ? "" : "s"}`,
    );
  }

  return parts.length ? parts.join(" · ") : null;
}
