// Shared "data grounding" for every Aria AI surface.
//
// Fetches the agent's live CRM state from Supabase and renders it into a
// prompt context block + a deterministic fallback.
//
// Consumers:
//   - lib/ai/agent.ts → prepends the context block to the tool-rules system
//                       prompt so the agent never starts blank (used by
//                       /api/ai/assistant — Ask Aria).

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLeadScores } from "@/lib/lead-score";

export type GroundingMode = "chat" | "voice";

// ── Row shapes (only the columns we select) ─────────────────────────────────

type ClientRow = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  /** Computed by loadLeadScores (lib/lead-score.ts), not the clients column. */
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  last_engagement_at: string | null;
};

type ShowingRow = {
  address: string | null;
  showing_date: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
};

export type AgentSnapshot = {
  agentName: string;
  todayLabel: string;
  clients: ClientRow[];
  showings: ShowingRow[];
  pendingDraftCount: number;
  /** Distinct clients with a pending draft, hottest first (names). */
  draftClientNames: string[];
  draftClientCount: number;
  recentMatches: { client_id: string | null }[];
  /** clientId → unnotified-match count (last 24h). */
  matchCountMap: Map<string, number>;
  /** clientId → ISO of the last real contact (unsent drafts and notes don't count). */
  lastContactMap: Map<string, string>;
};

// ── Formatting helpers ──────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "no budget set";
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`;
  if (max) return `up to $${Math.round(max / 1000)}k`;
  return `from $${Math.round(min! / 1000)}k`;
}

function fmtShowingDate(iso: string | null): string {
  if (!iso) return "TBD";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
}

// Supabase FK joins return the related row as object or array depending on how
// the relationship is defined — normalise to a single name.
function extractClientName(join: ShowingRow["clients"]): string {
  if (!join) return "Unknown";
  const row = Array.isArray(join) ? join[0] : join;
  return row?.name ?? "Unknown";
}

// ── Snapshot fetch ──────────────────────────────────────────────────────────

/**
 * Pulls the agent's live operating picture from Supabase. Every query is
 * wrapped in allSettled so a single failure can never break the AI response.
 */
export async function fetchAgentSnapshot(
  supabase: SupabaseClient,
  agentId: string,
): Promise<AgentSnapshot> {
  const now = new Date();
  const nowISO = now.toISOString();
  const minus30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const minus24h = new Date(Date.now() - 86_400_000).toISOString();
  const plus7d = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [
    profileRes,
    clientsRes,
    showingsRes,
    pendingDraftsRes,
    recentMatchesRes,
    recentActivitiesRes,
  ] = await Promise.allSettled([
    supabase
      .from("agent_profiles")
      .select("full_name")
      .eq("id", agentId)
      .maybeSingle(),

    // Closed clients aren't leads. Ranked by computed lead score below.
    supabase
      .from("clients")
      .select("id, name, town, status, budget_min, budget_max, last_engagement_at")
      .eq("agent_id", agentId)
      .neq("status", "closed"),

    supabase
      .from("showings")
      .select("address, showing_date, clients(name)")
      .eq("agent_id", agentId)
      .eq("status", "scheduled")
      .gte("showing_date", nowISO)
      .lte("showing_date", plus7d)
      .order("showing_date", { ascending: true })
      .limit(5),

    supabase
      .from("activities")
      .select("client_id, clients(name, status)", { count: "exact" })
      .eq("agent_id", agentId)
      .eq("ai_draft", true)
      .eq("approved", false)
      .eq("sent", false),

    supabase
      .from("property_matches")
      .select("client_id")
      .eq("agent_id", agentId)
      .eq("notified", false)
      .gte("created_at", minus24h),

    supabase
      .from("activities")
      .select("client_id, type, created_at, ai_draft, sent")
      .eq("agent_id", agentId)
      .gte("created_at", minus30d)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const agentName =
    profileRes.status === "fulfilled"
      ? (profileRes.value.data?.full_name ?? "Agent")
      : "Agent";

  // Top 10 by the same computed score the Clients screen shows (not the
  // clients.lead_score column, which nothing keeps up to date).
  const activeClients = (
    clientsRes.status === "fulfilled" ? (clientsRes.value.data ?? []) : []
  ) as Omit<ClientRow, "lead_score">[];
  const scores = await loadLeadScores(supabase, agentId, activeClients);
  const clients: ClientRow[] = activeClients
    .map((c) => ({ ...c, lead_score: scores.get(c.id)?.score ?? null }))
    .sort((a, b) => (b.lead_score ?? -1) - (a.lead_score ?? -1))
    .slice(0, 10);

  const showings = (
    showingsRes.status === "fulfilled" ? (showingsRes.value.data ?? []) : []
  ) as ShowingRow[];

  const pendingDraftCount =
    pendingDraftsRes.status === "fulfilled"
      ? (pendingDraftsRes.value.count ??
        pendingDraftsRes.value.data?.length ??
        0)
      : 0;

  const recentMatches = (
    recentMatchesRes.status === "fulfilled"
      ? (recentMatchesRes.value.data ?? [])
      : []
  ) as { client_id: string | null }[];

  const recentActivities = (
    recentActivitiesRes.status === "fulfilled"
      ? (recentActivitiesRes.value.data ?? [])
      : []
  ) as { client_id: string | null; type: string; created_at: string; ai_draft: boolean | null; sent: boolean | null }[];

  // A queued AI draft or an internal note isn't contact with the client.
  const lastContactMap = new Map<string, string>();
  for (const act of recentActivities) {
    if (act.ai_draft && !act.sent) continue;
    if (act.type === "note") continue;
    if (act.client_id && !lastContactMap.has(act.client_id)) {
      lastContactMap.set(act.client_id, act.created_at);
    }
  }
  // Older contact lives on clients.last_engagement_at.
  for (const c of clients) {
    const fromActivity = lastContactMap.get(c.id);
    if (c.last_engagement_at && (!fromActivity || c.last_engagement_at > fromActivity)) {
      lastContactMap.set(c.id, c.last_engagement_at);
    }
  }

  type DraftClient = { name: string | null; status: string | null };
  type DraftRow = { client_id: string; clients: DraftClient | DraftClient[] | null };
  const draftRows = (
    pendingDraftsRes.status === "fulfilled" ? (pendingDraftsRes.value.data ?? []) : []
  ) as DraftRow[];
  const draftClients = new Map<string, { name: string; score: number }>();
  for (const d of draftRows) {
    const c = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    if (!draftClients.has(d.client_id)) {
      // Past (closed) clients rank after the active pipeline.
      const score = c?.status === "closed" ? -100 : (scores.get(d.client_id)?.score ?? -1);
      draftClients.set(d.client_id, { name: c?.name ?? "a client", score });
    }
  }
  const draftClientNames = [...draftClients.values()]
    .sort((a, b) => b.score - a.score)
    .map((c) => c.name);

  const matchCountMap = new Map<string, number>();
  for (const m of recentMatches) {
    if (m.client_id) {
      matchCountMap.set(m.client_id, (matchCountMap.get(m.client_id) ?? 0) + 1);
    }
  }

  const todayLabel = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    agentName,
    todayLabel,
    clients,
    showings,
    pendingDraftCount,
    draftClientNames,
    draftClientCount: draftClients.size,
    recentMatches,
    matchCountMap,
    lastContactMap,
  };
}

// ── Derived rendering ─────────────────────────────────────────────────────────

function clientLines(snap: AgentSnapshot): string[] {
  return snap.clients.map((c) => {
    const lastContactISO = snap.lastContactMap.get(c.id);
    const days = lastContactISO ? daysSince(lastContactISO) : null;
    const contactNote =
      days === null
        ? "no contact logged"
        : days === 0
          ? "contacted today"
          : days === 1
            ? "contacted yesterday"
            : `${days}d since last contact`;
    const matches = snap.matchCountMap.get(c.id);
    const matchNote = matches
      ? ` · ${matches} new match${matches > 1 ? "es" : ""}`
      : "";
    const score = c.lead_score ? ` · score ${c.lead_score}/10` : "";
    return (
      `• ${c.name} — ${c.town ?? "no area"}, ` +
      `${fmtBudget(c.budget_min, c.budget_max)}, ` +
      `${c.status ?? "buyer"}${score} · ${contactNote}${matchNote}`
    );
  });
}

function showingLines(snap: AgentSnapshot): string[] {
  return snap.showings.map(
    (s) =>
      `• ${fmtShowingDate(s.showing_date)} — ${s.address ?? "Unknown address"} with ${extractClientName(s.clients)}`,
  );
}

/** "Marcus, Rachel and 20 others" — drafts described by who they're for, never a raw count. */
function draftsPhrase(snap: AgentSnapshot): string | null {
  if (snap.draftClientCount === 0) return null;
  const named = snap.draftClientNames.slice(0, 2);
  const others = snap.draftClientCount - named.length;
  return others > 0 ? `${named.join(", ")} and ${others} other${others > 1 ? "s" : ""}` : named.join(" and ");
}

/**
 * The single highest-leverage thing to surface for "what should I do today?".
 * Pending drafts are a background chore — they only win when nothing more
 * specific (a showing, a hot lead going quiet, a new match) is pending.
 */
export function priorityHint(snap: AgentSnapshot): string {
  // Calendar day in New Jersey — showings are upcoming, so daysSince() would be negative.
  const njDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const today = njDay(new Date().toISOString());
  const todayShowing = snap.showings.find(
    (s) => s.showing_date && njDay(s.showing_date) === today,
  );
  if (todayShowing) {
    return `TOP PRIORITY TODAY: Showing at ${todayShowing.address ?? "an address"} today — confirm details and prep notes.`;
  }
  if (snap.recentMatches.length > 0) {
    return `TOP PRIORITY TODAY: ${snap.recentMatches.length} new property match${snap.recentMatches.length > 1 ? "es" : ""} — notify the relevant client${snap.matchCountMap.size > 1 ? "s" : ""}.`;
  }
  const daysQuiet = (id: string) =>
    snap.lastContactMap.has(id) ? daysSince(snap.lastContactMap.get(id)!) : 999;
  const uncontactedHot = snap.clients
    .filter(
      (c) =>
        c.lead_score != null &&
        c.lead_score >= 7 &&
        ["new", "contacted", "showing", "offer"].includes(c.status ?? "new") &&
        daysQuiet(c.id) >= 5,
    )
    .sort((a, b) => daysQuiet(b.id) - daysQuiet(a.id))[0];
  if (uncontactedHot) {
    return `TOP PRIORITY TODAY: ${uncontactedHot.name} is a hot lead — reach out to re-engage.`;
  }
  const drafts = draftsPhrase(snap);
  if (drafts) {
    return `TOP PRIORITY TODAY: nothing urgent — clear follow-up drafts for ${drafts}.`;
  }
  return "";
}

/**
 * The live-data portion of the prompt (no persona, no response-style rules).
 * The tool-agent appends this to its own tool-rules system prompt so it starts
 * every turn knowing the agent, their hot leads, and today's calendar.
 */
export function renderContextBlock(snap: AgentSnapshot): string {
  const hint = priorityHint(snap);
  return [
    `CURRENT BUSINESS CONTEXT — live from ${snap.agentName}'s CRM. Today is ${snap.todayLabel}.`,
    "",
    snap.clients.length > 0
      ? `ACTIVE CLIENT ROSTER (${snap.clients.length} shown, sorted by readiness score):\n${clientLines(snap).join("\n")}`
      : "ACTIVE CLIENT ROSTER: No clients on file yet.",
    "",
    snap.showings.length > 0
      ? `UPCOMING SHOWINGS (next 7 days):\n${showingLines(snap).join("\n")}`
      : "UPCOMING SHOWINGS: None scheduled in the next 7 days.",
    "",
    snap.draftClientCount > 0
      ? `FOLLOW-UP DRAFTS: ready to review for ${draftsPhrase(snap)} (${snap.draftClientCount} client${snap.draftClientCount > 1 ? "s" : ""}). Background chore — bring up only when asked about drafts/follow-ups or when nothing more specific is pending; never lead with a raw draft count.`
      : "FOLLOW-UP DRAFTS: none waiting.",
    snap.recentMatches.length > 0
      ? `PROPERTY MATCHES: ${snap.recentMatches.length} new match${snap.recentMatches.length > 1 ? "es" : ""} across ${snap.matchCountMap.size} client${snap.matchCountMap.size > 1 ? "s" : ""} in the last 24 hours.`
      : "PROPERTY MATCHES: None in the last 24 hours.",
    hint ? `\n${hint}` : "",
    "",
    "Treat this context as already-known truth: never say you lack access to the agent's data. Reference clients by first name and addresses directly. Still use tools to fetch anything not listed here (specific live MLS listings, full client preferences) or to take actions.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Deterministic, data-aware fallback for when Claude is unavailable (no API key
 * or an API error). Surfaces the most urgent real data point — never generic
 * advice, and never the drafts backlog ahead of something specific.
 * (/api/ai/assistant answers the question itself via lib/ai/insights instead.)
 */
export function deterministicFallback(snap: AgentSnapshot): string {
  if (snap.showings.length > 0) {
    const next = snap.showings[0];
    return `Your next showing is at ${next.address ?? "an address"} with ${extractClientName(next.clients)} on ${fmtShowingDate(next.showing_date)}.`;
  }
  if (snap.recentMatches.length > 0) {
    return `${snap.recentMatches.length} new property match${snap.recentMatches.length > 1 ? "es" : ""} came in today — check your client profiles to review and notify.`;
  }
  if (snap.clients.length > 0) {
    const top = snap.clients[0];
    return `Your top lead right now is ${top.name}, searching in ${top.town ?? "NJ"} with a ${fmtBudget(top.budget_min, top.budget_max)} budget.`;
  }
  const drafts = draftsPhrase(snap);
  if (drafts) {
    return `Follow-up drafts are ready for ${drafts} — open Follow-ups to review and send.`;
  }
  return "No client data yet. Add your first client to get started.";
}
