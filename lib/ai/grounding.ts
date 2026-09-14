// Shared "data grounding" for every Aria AI surface.
//
// This is the single source of truth that was previously duplicated/forked
// between /api/ai/assistant (great data grounding, no tools) and /api/ai
// (tool loop, but started "blank"). It fetches the agent's live CRM state from
// Supabase and renders it into prompt fragments + a deterministic fallback.
//
// Consumers:
//   - lib/ai/agent.ts          → prepends the context block to the tool-rules
//                                 system prompt so the agent never starts blank.
//   - app/api/ai/assistant     → renders the full grounded prompt (no tools).

import type { SupabaseClient } from "@supabase/supabase-js";

export type GroundingMode = "chat" | "voice";

// ── Row shapes (only the columns we select) ─────────────────────────────────

type ClientRow = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
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
  recentMatches: { client_id: string | null }[];
  /** clientId → unnotified-match count (last 24h). */
  matchCountMap: Map<string, number>;
  /** clientId → ISO of most recent activity (last 7d). */
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
  const minus7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
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

    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max")
      .eq("agent_id", agentId)
      .order("lead_score", { ascending: false })
      .limit(10),

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
      .select("id", { count: "exact" })
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
      .select("client_id, type, created_at")
      .eq("agent_id", agentId)
      .gte("created_at", minus7d)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const agentName =
    profileRes.status === "fulfilled"
      ? (profileRes.value.data?.full_name ?? "Agent")
      : "Agent";

  const clients = (
    clientsRes.status === "fulfilled" ? (clientsRes.value.data ?? []) : []
  ) as ClientRow[];

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
  ) as { client_id: string | null; type: string; created_at: string }[];

  const lastContactMap = new Map<string, string>();
  for (const act of recentActivities) {
    if (act.client_id && !lastContactMap.has(act.client_id)) {
      lastContactMap.set(act.client_id, act.created_at);
    }
  }

  const matchCountMap = new Map<string, number>();
  for (const m of recentMatches) {
    if (m.client_id) {
      matchCountMap.set(m.client_id, (matchCountMap.get(m.client_id) ?? 0) + 1);
    }
  }

  const todayLabel = now.toLocaleDateString("en-US", {
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
        ? "never contacted"
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

/** The single highest-leverage thing to surface for "what should I do today?". */
export function priorityHint(snap: AgentSnapshot): string {
  if (snap.pendingDraftCount > 0) {
    return `TOP PRIORITY TODAY: ${snap.pendingDraftCount} AI draft${snap.pendingDraftCount > 1 ? "s" : ""} in the inbox need approval before they expire.`;
  }
  const todayShowing = snap.showings.find(
    (s) => s.showing_date && daysSince(s.showing_date) === 0,
  );
  if (todayShowing) {
    return `TOP PRIORITY TODAY: Showing at ${todayShowing.address ?? "an address"} today — confirm details and prep notes.`;
  }
  if (snap.recentMatches.length > 0) {
    return `TOP PRIORITY TODAY: ${snap.recentMatches.length} new property match${snap.recentMatches.length > 1 ? "es" : ""} — notify the relevant client${snap.matchCountMap.size > 1 ? "s" : ""}.`;
  }
  const uncontactedHot = snap.clients
    .filter((c) => c.lead_score != null && c.lead_score >= 7)
    .sort((a, b) => {
      const da = snap.lastContactMap.has(a.id)
        ? daysSince(snap.lastContactMap.get(a.id)!)
        : 999;
      const db = snap.lastContactMap.has(b.id)
        ? daysSince(snap.lastContactMap.get(b.id)!)
        : 999;
      return db - da;
    })[0];
  if (uncontactedHot) {
    return `TOP PRIORITY TODAY: ${uncontactedHot.name} is a hot lead — reach out to re-engage.`;
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
    snap.pendingDraftCount > 0
      ? `INBOX: ${snap.pendingDraftCount} AI draft${snap.pendingDraftCount > 1 ? "s" : ""} awaiting approval.`
      : "INBOX: All drafts reviewed.",
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
 * The full grounded system prompt used by /api/ai/assistant (persona + context
 * + response-style rules). Preserves that route's original behavior.
 */
export function renderAssistantSystemPrompt(
  snap: AgentSnapshot,
  mode: GroundingMode,
): string {
  return [
    `You are Aria, the AI revenue operating system for ${snap.agentName}'s New Jersey real estate business.`,
    renderContextBlock(snap),
    "",
    "RESPONSE RULES:",
    "— Answer from the real data above. Reference clients by first name. Reference addresses directly.",
    "— When asked 'What should I do today?' — surface the TOP PRIORITY above, then briefly explain why.",
    "— Never say 'I don't have access to your data' — you do, it is above.",
    "— Never give generic real estate advice when specific client data is available.",
    "— If asked about data not in context (specific MLS price, legal advice, market stats), say so in one sentence and suggest where to look.",
    "— No bullet lists or markdown in responses. Write in natural sentences.",
    mode === "voice"
      ? "— VOICE MODE: 1–2 sentences only. Spoken prose. No lists."
      : "— CHAT MODE: 2–4 sentences. Direct and specific. Revenue-focused.",
  ].join("\n");
}

/**
 * Deterministic, data-aware fallback for when Claude is unavailable (no API key
 * or an API error). Surfaces the most urgent real data point — never generic
 * advice.
 */
export function deterministicFallback(snap: AgentSnapshot): string {
  if (snap.pendingDraftCount > 0) {
    return `You have ${snap.pendingDraftCount} AI draft${snap.pendingDraftCount > 1 ? "s" : ""} in your inbox waiting for approval. Open Follow-ups to review and send.`;
  }
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
  return "No client data yet. Add your first client to get started.";
}
