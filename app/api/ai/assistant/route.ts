// POST /api/ai/assistant
//
// The core Aria intelligence API. Fetches live agent data from Supabase,
// builds a grounded system prompt, then calls Claude with full context.
//
// Unlike /api/ai (which accepts raw context from the client), this route
// fetches the data itself — the client cannot inject or fake context.
//
// Request body:
//   { question: string, mode?: "chat" | "voice", history?: [{role, content}] }
//
// Response:
//   { reply: string }
//
// Mode controls token budget and response style:
//   "chat"  → 300 tokens, prose, 2–4 sentences
//   "voice" → 80 tokens, spoken sentences, no lists

import { NextResponse } from "next/server";
import { getAnthropic } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

// Use the same model as lib/ai.ts
const MODEL = "claude-sonnet-4-20250514";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (86_400_000));
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

// Supabase FK joins return the related row as object or array depending on
// how the relationship is defined — normalise to a single object.
function extractClientName(
  join: { name: string | null } | { name: string | null }[] | null
): string {
  if (!join) return "Unknown";
  const row = Array.isArray(join) ? join[0] : join;
  return row?.name ?? "Unknown";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    question?: unknown;
    mode?: unknown;
    history?: unknown;
  };

  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const mode = String(body.mode ?? "chat") === "voice" ? "voice" : "chat";
  const rawHistory = Array.isArray(body.history) ? body.history : [];

  const now = new Date();
  const nowISO = now.toISOString();
  const minus7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const minus24h = new Date(Date.now() - 86_400_000).toISOString();
  const plus7d = new Date(Date.now() + 7 * 86_400_000).toISOString();

  // ── Parallel Supabase queries ─────────────────────────────────────────────
  // Each wrapped in allSettled so a single failure cannot break the response.

  const [
    profileRes,
    clientsRes,
    showingsRes,
    pendingDraftsRes,
    recentMatchesRes,
    recentActivitiesRes,
  ] = await Promise.allSettled([

    // Agent name
    supabase
      .from("agent_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),

    // Top 10 clients by lead score — the agent's active roster
    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max")
      .eq("agent_id", user.id)
      .order("lead_score", { ascending: false })
      .limit(10),

    // Upcoming scheduled showings in next 7 days
    supabase
      .from("showings")
      .select("address, showing_date, clients(name)")
      .eq("agent_id", user.id)
      .eq("status", "scheduled")
      .gte("showing_date", nowISO)
      .lte("showing_date", plus7d)
      .order("showing_date", { ascending: true })
      .limit(5),

    // AI drafts pending agent approval
    supabase
      .from("activities")
      .select("id", { count: "exact" })
      .eq("agent_id", user.id)
      .eq("ai_draft", true)
      .eq("approved", false)
      .eq("sent", false),

    // Unnotified property matches in last 24h (per client)
    supabase
      .from("property_matches")
      .select("client_id")
      .eq("agent_id", user.id)
      .eq("notified", false)
      .gte("created_at", minus24h),

    // Recent activities (last 7d) — used to compute last-contact per client
    supabase
      .from("activities")
      .select("client_id, type, created_at")
      .eq("agent_id", user.id)
      .gte("created_at", minus7d)
      .order("created_at", { ascending: false })
      .limit(100),

  ]);

  // ── Extract with graceful fallbacks ───────────────────────────────────────

  const agentName =
    profileRes.status === "fulfilled"
      ? (profileRes.value.data?.full_name ?? "Agent")
      : "Agent";

  const clients =
    clientsRes.status === "fulfilled"
      ? (clientsRes.value.data ?? [])
      : [];

  const showings =
    showingsRes.status === "fulfilled"
      ? (showingsRes.value.data ?? [])
      : [];

  const pendingDraftCount =
    pendingDraftsRes.status === "fulfilled"
      ? (pendingDraftsRes.value.count ?? pendingDraftsRes.value.data?.length ?? 0)
      : 0;

  const recentMatches =
    recentMatchesRes.status === "fulfilled"
      ? (recentMatchesRes.value.data ?? [])
      : [];

  const recentActivities =
    recentActivitiesRes.status === "fulfilled"
      ? (recentActivitiesRes.value.data ?? [])
      : [];

  // ── Derived data ──────────────────────────────────────────────────────────

  // Last-contact date per client (from activities in last 7d)
  const lastContactMap = new Map<string, string>(); // clientId → ISO
  for (const act of recentActivities) {
    if (act.client_id && !lastContactMap.has(act.client_id)) {
      lastContactMap.set(act.client_id, act.created_at as string);
    }
  }

  // Unnotified match count per client (last 24h)
  const matchCountMap = new Map<string, number>(); // clientId → count
  for (const m of recentMatches) {
    if (m.client_id) {
      matchCountMap.set(m.client_id, (matchCountMap.get(m.client_id) ?? 0) + 1);
    }
  }

  // ── Build system prompt ───────────────────────────────────────────────────

  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Client roster lines
  const clientLines = clients.map((c) => {
    const lastContactISO = lastContactMap.get(c.id as string);
    const days = lastContactISO ? daysSince(lastContactISO) : null;
    const contactNote =
      days === null ? "never contacted"
      : days === 0 ? "contacted today"
      : days === 1 ? "contacted yesterday"
      : `${days}d since last contact`;
    const matches = matchCountMap.get(c.id as string);
    const matchNote = matches ? ` · ${matches} new match${matches > 1 ? "es" : ""}` : "";
    const score = (c.lead_score as number | null)
      ? ` · score ${c.lead_score as number}/10`
      : "";
    return (
      `• ${c.name as string} — ${(c.town as string | null) ?? "no area"}, ` +
      `${fmtBudget(c.budget_min as number | null, c.budget_max as number | null)}, ` +
      `${(c.status as string | null) ?? "buyer"}${score} · ${contactNote}${matchNote}`
    );
  });

  // Showing lines
  const showingLines = showings.map((s) => {
    const clientName = extractClientName(
      s.clients as { name: string | null } | { name: string | null }[] | null
    );
    return `• ${fmtShowingDate(s.showing_date as string | null)} — ${(s.address as string | null) ?? "Unknown address"} with ${clientName}`;
  });

  // Determine today's top priority for "what should I do" queries
  let priorityHint = "";
  if (pendingDraftCount > 0) {
    priorityHint = `TOP PRIORITY TODAY: ${pendingDraftCount} AI draft${pendingDraftCount > 1 ? "s" : ""} in the inbox need approval before they expire.`;
  } else if (showings.some((s) => daysSince(s.showing_date as string) === 0)) {
    const todayShowing = showings.find((s) => daysSince(s.showing_date as string) === 0);
    if (todayShowing) {
      priorityHint = `TOP PRIORITY TODAY: Showing at ${(todayShowing.address as string | null) ?? "an address"} today — confirm details and prep notes.`;
    }
  } else if (recentMatches.length > 0) {
    priorityHint = `TOP PRIORITY TODAY: ${recentMatches.length} new property match${recentMatches.length > 1 ? "es" : ""} — notify the relevant client${matchCountMap.size > 1 ? "s" : ""}.`;
  } else {
    // Find hottest client with oldest contact
    const uncontactedHot = clients
      .filter((c) => (c.lead_score as number | null) && (c.lead_score as number) >= 7)
      .sort((a, b) => {
        const da = lastContactMap.has(a.id as string) ? daysSince(lastContactMap.get(a.id as string)!) : 999;
        const db = lastContactMap.has(b.id as string) ? daysSince(lastContactMap.get(b.id as string)!) : 999;
        return db - da;
      })[0];
    if (uncontactedHot) {
      priorityHint = `TOP PRIORITY TODAY: ${uncontactedHot.name as string} is a hot lead — reach out to re-engage.`;
    }
  }

  const systemPrompt = [
    `You are Aria, the AI revenue operating system for ${agentName}'s New Jersey real estate business.`,
    `Today is ${todayLabel}.`,
    "",
    clients.length > 0
      ? `ACTIVE CLIENT ROSTER (${clients.length} shown, sorted by readiness score):\n${clientLines.join("\n")}`
      : "ACTIVE CLIENT ROSTER: No clients on file yet.",
    "",
    showings.length > 0
      ? `UPCOMING SHOWINGS (next 7 days):\n${showingLines.join("\n")}`
      : "UPCOMING SHOWINGS: None scheduled in the next 7 days.",
    "",
    pendingDraftCount > 0
      ? `INBOX: ${pendingDraftCount} AI draft${pendingDraftCount > 1 ? "s" : ""} awaiting approval.`
      : "INBOX: All drafts reviewed.",
    recentMatches.length > 0
      ? `PROPERTY MATCHES: ${recentMatches.length} new match${recentMatches.length > 1 ? "es" : ""} across ${matchCountMap.size} client${matchCountMap.size > 1 ? "s" : ""} in the last 24 hours.`
      : "PROPERTY MATCHES: None in the last 24 hours.",
    priorityHint ? `\n${priorityHint}` : "",
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
  ]
    .filter((line) => line !== null)
    .join("\n");

  // ── Call Claude ───────────────────────────────────────────────────────────

  const anthropic = getAnthropic();

  // Build conversation messages (multi-turn support)
  type MessageParam = { role: "user" | "assistant"; content: string };
  const messages: MessageParam[] = [
    ...rawHistory
      .slice(-6)
      .filter(
        (h): h is { role: string; content: string } =>
          typeof h === "object" && h !== null &&
          (h as { role?: string }).role !== undefined
      )
      .filter((h) => h.role === "user" || h.role === "assistant")
      .map((h) => ({
        role: h.role as "user" | "assistant",
        content: String(h.content ?? ""),
      })),
    { role: "user", content: question },
  ];

  const maxTokens = mode === "voice" ? 80 : 300;

  let reply = "";

  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      });
      const block = msg.content[0];
      if (block && block.type === "text") {
        reply = block.text.trim();
      }
    } catch (err) {
      console.error("[/api/ai/assistant] Claude error:", err);
    }
  }

  // ── Deterministic fallback (no API key, or Claude failed) ─────────────────
  // Surface the most urgent real data point directly — never generic advice.
  if (!reply) {
    if (pendingDraftCount > 0) {
      reply = `You have ${pendingDraftCount} AI draft${pendingDraftCount > 1 ? "s" : ""} in your inbox waiting for approval. Open Follow-ups to review and send.`;
    } else if (showings.length > 0) {
      const next = showings[0];
      const clientName = extractClientName(
        next.clients as { name: string | null } | { name: string | null }[] | null
      );
      reply = `Your next showing is at ${(next.address as string | null) ?? "an address"} with ${clientName} on ${fmtShowingDate(next.showing_date as string | null)}.`;
    } else if (recentMatches.length > 0) {
      reply = `${recentMatches.length} new property match${recentMatches.length > 1 ? "es" : ""} came in today — check your client profiles to review and notify.`;
    } else if (clients.length > 0) {
      const top = clients[0];
      reply = `Your top lead right now is ${top.name as string}, searching in ${(top.town as string | null) ?? "NJ"} with a ${fmtBudget(top.budget_min as number | null, top.budget_max as number | null)} budget.`;
    } else {
      reply = "No client data yet. Add your first client to get started.";
    }
  }

  return NextResponse.json({ reply });
}
