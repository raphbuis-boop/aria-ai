// Read-only answers to the questions agents actually ask Ask Aria:
//   "Who's my hottest lead?"            → getHottestLeads
//   "Who haven't I talked to in a while?" → getStaleClients
//   "What should I do today?"            → getTodayPriorities
//
// Shared by the agent's tools (lib/ai/tools) and the no-AI fallback in
// /api/ai/assistant, so both answer from the same real data. Every "why" is
// built from logged rows — never invented.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ARIA_TASK_KINDS } from "@/lib/sms/tasks";
import { ariaSmsEnabled } from "@/lib/feature-flags";
import { loadLeadScores } from "@/lib/lead-score";

const TZ = "America/New_York";
const DAY_MS = 86_400_000;

/** Statuses that are still a lead (under_contract/closed are deals, not leads). */
const ACTIVE_LEAD_STATUSES = new Set(["new", "contacted", "showing", "offer"]);

/** clients.source values written by bulk imports — same set Today uses for "New leads". */
const IMPORT_SOURCES = new Set(["csv_import", "sphere", "google_contacts", "past_client"]);

const STAGE_RANK: Record<string, number> = { offer: 4, showing: 3, contacted: 2, new: 1 };

const STAGE_LABEL: Record<string, string> = {
  new: "New lead",
  contacted: "In conversation",
  showing: "Touring homes",
  offer: "At offer stage",
  under_contract: "Under contract",
};

/** Gone this long without contact = "a while". */
const STALE_AFTER_DAYS = 14;
/** A hot lead (score ≥ 8) this quiet is a today priority. */
const HOT_QUIET_AFTER_DAYS = 5;

// ── Shared types ──────────────────────────────────────────────────────────────

export type ClientInsight = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  leadScore: number | null;
  budget: string | null;
  /** Null = no contact logged at all. */
  daysSinceContact: number | null;
  /** One line, built only from real rows. */
  why: string;
};

export type HottestLeads = {
  leads: ClientInsight[];
  /** Active leads considered (excludes under contract / closed). */
  activeLeadCount: number;
};

export type StaleClients = {
  /** Contacted before, quiet longest first. */
  clients: ClientInsight[];
  staleAfterDays: number;
  /** Active clients with no contact logged at all. */
  neverContactedCount: number;
  /** Highest-scored of those, for a nudge. */
  neverContacted: ClientInsight[];
};

export type TodayPriorities = {
  date: string;
  showingsToday: { clientId: string | null; clientName: string | null; address: string | null; time: string; done: boolean }[];
  needsYou: { clientId: string | null; clientName: string | null; title: string }[];
  tasksDue: { clientId: string | null; clientName: string | null; title: string; overdue: boolean }[];
  tasksDueCount: number;
  newLeadsUncontacted: { id: string; name: string; source: string | null; town: string | null }[];
  hotLeadsGoingQuiet: ClientInsight[];
  closingsSoon: { clientId: string; clientName: string | null; address: string | null; daysUntil: number }[];
  /** Pending AI follow-up drafts, summarized by who they're for — never a bare count. */
  followUpDrafts: { clientCount: number; topClients: string[] } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Rel<T> = T | T[] | null | undefined;
const one = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null));

function firstName(name: string): string {
  // "James & Sarah Wilson" reads naturally as-is; single names → first word.
  return name.includes("&") ? name : (name.split(" ")[0] ?? name);
}

function fmtMoneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  return `$${Math.round(n / 1000)}k`;
}

function fmtBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${fmtMoneyShort(min)}–${fmtMoneyShort(max)}`;
  if (max) return `up to ${fmtMoneyShort(max)}`;
  return `${fmtMoneyShort(min!)}+`;
}

/** UTC offset of America/New_York at `at`, in minutes (e.g. -240 in summer). */
function etOffsetMinutes(at: Date): number {
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-4"
  const m = tzName?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return -300;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

/** Start of today and tomorrow in New Jersey time, as UTC Dates. */
function etDayBounds(now: Date): { todayStart: Date; tomorrowStart: Date } {
  const [y, mo, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  const todayStart = new Date(Date.UTC(y, mo - 1, d) - etOffsetMinutes(now) * 60_000);
  return { todayStart, tomorrowStart: new Date(todayStart.getTime() + DAY_MS) };
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
}

function daysAgoPhrase(days: number | null): string {
  if (days === null) return "no contact logged yet";
  if (days <= 0) return "you talked today";
  if (days === 1) return "you talked yesterday";
  return `last contact ${days} days ago`;
}

// ── Pipeline: non-closed clients + when the agent last actually reached them ──

type ClientRow = {
  id: string;
  name: string | null;
  town: string | null;
  status: string | null;
  budget_min: number | null;
  budget_max: number | null;
  last_engagement_at: string | null;
  created_at: string;
  source: string | null;
};

type PipelineClient = ClientInsight & { createdAt: string; source: string | null; stageRank: number };

/**
 * A real touch: anything but an unsent AI draft (a queued draft isn't
 * contact) or an internal note.
 */
function isRealTouch(a: { type: string | null; ai_draft: boolean | null; sent: boolean | null }): boolean {
  if (a.ai_draft && !a.sent) return false;
  return a.type !== "note";
}

async function loadPipeline(supabase: SupabaseClient, agentId: string, now: Date): Promise<PipelineClient[]> {
  const since = new Date(now.getTime() - 120 * DAY_MS).toISOString();
  const [clientsRes, actsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, town, status, budget_min, budget_max, last_engagement_at, created_at, source")
      .eq("agent_id", agentId)
      .neq("status", "closed"),
    supabase
      .from("activities")
      .select("client_id, type, created_at, ai_draft, sent")
      .eq("agent_id", agentId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (clientsRes.error) throw new Error(`clients: ${clientsRes.error.message}`);
  if (actsRes.error) console.error("[insights] activities:", actsRes.error.message);

  const lastTouch = new Map<string, string>();
  for (const a of (actsRes.data ?? []) as { client_id: string; type: string | null; created_at: string; ai_draft: boolean | null; sent: boolean | null }[]) {
    if (!lastTouch.has(a.client_id) && isRealTouch(a)) lastTouch.set(a.client_id, a.created_at);
  }

  const clients = (clientsRes.data ?? []) as ClientRow[];
  // Same computed score the Clients screen shows, not clients.lead_score.
  const scores = await loadLeadScores(supabase, agentId, clients);

  return clients.map((c) => {
    const touches = [lastTouch.get(c.id), c.last_engagement_at].filter((t): t is string => Boolean(t));
    const latest = touches.length ? Math.max(...touches.map((t) => new Date(t).getTime())) : null;
    return {
      id: c.id,
      name: (c.name ?? "").trim() || "Client",
      town: c.town,
      status: c.status,
      leadScore: scores.get(c.id)?.score ?? null,
      budget: fmtBudget(c.budget_min, c.budget_max),
      daysSinceContact: latest === null ? null : Math.max(0, Math.floor((now.getTime() - latest) / DAY_MS)),
      why: "",
      createdAt: c.created_at,
      source: c.source,
      stageRank: STAGE_RANK[c.status ?? ""] ?? 0,
    };
  });
}

function toInsight(c: PipelineClient, why: string): ClientInsight {
  return {
    id: c.id,
    name: c.name,
    town: c.town,
    status: c.status,
    leadScore: c.leadScore,
    budget: c.budget,
    daysSinceContact: c.daysSinceContact,
    why,
  };
}

/** "Touring homes in Tenafly ($900k–$1.2M)" */
function profilePhrase(c: PipelineClient): string {
  const stage = STAGE_LABEL[c.status ?? ""] ?? "Lead";
  const where = c.town ? ` in ${c.town}` : "";
  const budget = c.budget ? ` (${c.budget})` : "";
  return `${stage}${where}${budget}`;
}

// ── Hottest leads ─────────────────────────────────────────────────────────────

export async function getHottestLeads(
  supabase: SupabaseClient,
  agentId: string,
  limit = 3,
  now = new Date(),
): Promise<HottestLeads> {
  const pipeline = (await loadPipeline(supabase, agentId, now)).filter((c) =>
    ACTIVE_LEAD_STATUSES.has(c.status ?? "new"),
  );

  // Score first; stage then recency break ties so the answer is stable.
  const ranked = [...pipeline].sort(
    (a, b) =>
      (b.leadScore ?? -1) - (a.leadScore ?? -1) ||
      b.stageRank - a.stageRank ||
      (a.daysSinceContact ?? 9999) - (b.daysSinceContact ?? 9999),
  );
  const top = ranked.slice(0, Math.max(1, Math.min(limit, 10)));
  if (top.length === 0) return { leads: [], activeLeadCount: 0 };

  const ids = top.map((c) => c.id);
  const in7d = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const minus7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const [showingsRes, engagementRes, matchesRes] = await Promise.all([
    supabase
      .from("showings")
      .select("client_id, address, showing_date")
      .eq("agent_id", agentId)
      .in("client_id", ids)
      .eq("status", "scheduled")
      .gte("showing_date", now.toISOString())
      .lte("showing_date", in7d)
      .order("showing_date", { ascending: true }),
    // Fail-soft: the table may not exist on older databases.
    supabase
      .from("client_engagement_events")
      .select("client_id, event_type")
      .eq("agent_id", agentId)
      .in("client_id", ids)
      .gte("created_at", minus7d),
    supabase
      .from("property_matches")
      .select("client_id")
      .eq("agent_id", agentId)
      .in("client_id", ids)
      .gte("created_at", minus7d),
  ]);

  const nextShowing = new Map<string, { address: string | null; showing_date: string }>();
  for (const s of (showingsRes.data ?? []) as { client_id: string; address: string | null; showing_date: string }[]) {
    if (!nextShowing.has(s.client_id)) nextShowing.set(s.client_id, s);
  }
  const engagement = new Map<string, { views: number; favorites: number; inquiries: number }>();
  for (const e of (engagementRes.data ?? []) as { client_id: string; event_type: string }[]) {
    const cur = engagement.get(e.client_id) ?? { views: 0, favorites: 0, inquiries: 0 };
    if (e.event_type === "view") cur.views += 1;
    else if (e.event_type === "favorite") cur.favorites += 1;
    else if (e.event_type === "inquiry") cur.inquiries += 1;
    engagement.set(e.client_id, cur);
  }
  const newMatches = new Map<string, number>();
  for (const m of (matchesRes.data ?? []) as { client_id: string }[]) {
    newMatches.set(m.client_id, (newMatches.get(m.client_id) ?? 0) + 1);
  }

  const leads = top.map((c) => {
    const signals: string[] = [];
    const show = nextShowing.get(c.id);
    if (show) signals.push(`showing ${fmtWeekday(show.showing_date)} at ${show.address ?? "a property"}`);
    const eng = engagement.get(c.id);
    if (eng?.inquiries) signals.push("asked about a listing this week");
    else if (eng?.favorites) signals.push(`favorited ${eng.favorites === 1 ? "a home" : `${eng.favorites} homes`} this week`);
    else if (eng?.views) signals.push(`viewed ${eng.views} listing${eng.views === 1 ? "" : "s"} this week`);
    const matches = newMatches.get(c.id);
    if (matches && signals.length < 2) signals.push(`${matches} new MLS match${matches === 1 ? "" : "es"} this week`);
    signals.push(daysAgoPhrase(c.daysSinceContact));
    return toInsight(c, `${profilePhrase(c)}; ${signals.slice(0, 2).join(", ")}`);
  });

  return { leads, activeLeadCount: pipeline.length };
}

// ── Stale clients ─────────────────────────────────────────────────────────────

export async function getStaleClients(
  supabase: SupabaseClient,
  agentId: string,
  limit = 5,
  now = new Date(),
): Promise<StaleClients> {
  const pipeline = await loadPipeline(supabase, agentId, now);
  const contacted = pipeline
    .filter((c) => c.daysSinceContact !== null)
    // Longest silence first; a hotter lead wins a tie.
    .sort((a, b) => b.daysSinceContact! - a.daysSinceContact! || (b.leadScore ?? -1) - (a.leadScore ?? -1));

  // Prefer people past the "a while" line; if nobody is, still name the quietest.
  const pastLine = contacted.filter((c) => c.daysSinceContact! >= STALE_AFTER_DAYS);
  const picked = (pastLine.length > 0 ? pastLine : contacted).slice(0, Math.max(1, Math.min(limit, 15)));

  const never = pipeline
    .filter((c) => c.daysSinceContact === null)
    .sort((a, b) => (b.leadScore ?? -1) - (a.leadScore ?? -1));

  return {
    clients: picked.map((c) => toInsight(c, `${profilePhrase(c)}; ${daysAgoPhrase(c.daysSinceContact)}`)),
    staleAfterDays: STALE_AFTER_DAYS,
    neverContactedCount: never.length,
    neverContacted: never.slice(0, 3).map((c) => toInsight(c, `${profilePhrase(c)}; no contact logged yet`)),
  };
}

// ── Today's priorities ────────────────────────────────────────────────────────

export async function getTodayPriorities(
  supabase: SupabaseClient,
  agentId: string,
  now = new Date(),
): Promise<TodayPriorities> {
  const { todayStart, tomorrowStart } = etDayBounds(now);
  const minus7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const in7d = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const smsEnabled = ariaSmsEnabled();

  const [pipeline, showingsRes, tasksRes, requestsRes, closingsRes, draftsRes] = await Promise.all([
    loadPipeline(supabase, agentId, now),
    supabase
      .from("showings")
      .select("address, showing_date, status, clients(id, name)")
      .eq("agent_id", agentId)
      .gte("showing_date", todayStart.toISOString())
      .lt("showing_date", tomorrowStart.toISOString())
      .in("status", ["scheduled", "completed"])
      .order("showing_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("title, due_at, kind, client_id, clients(name)")
      .eq("agent_id", agentId)
      .eq("done", false)
      .lt("due_at", tomorrowStart.toISOString())
      .order("due_at", { ascending: true }),
    smsEnabled
      ? supabase
          .from("showings")
          .select("address, requested_time_text, clients(id, name)")
          .eq("agent_id", agentId)
          .eq("status", "requested")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("transactions")
      .select("client_id, address, closing_date, clients(name)")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .gte("closing_date", todayStart.toISOString())
      .lte("closing_date", in7d)
      .order("closing_date", { ascending: true }),
    supabase
      .from("activities")
      .select("client_id")
      .eq("agent_id", agentId)
      .eq("ai_draft", true)
      .eq("approved", false)
      .eq("sent", false),
  ]);

  for (const [name, res] of Object.entries({ showingsRes, tasksRes, requestsRes, closingsRes, draftsRes })) {
    if (res.error) console.error(`[insights] today ${name}:`, res.error.message);
  }

  const byId = new Map(pipeline.map((c) => [c.id, c]));

  const showingsToday = ((showingsRes.data ?? []) as { address: string | null; showing_date: string; status: string; clients: Rel<{ id: string; name: string }> }[]).map((s) => {
    const client = one(s.clients);
    return {
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
      address: s.address,
      time: fmtTime(s.showing_date),
      done: s.status === "completed" || new Date(s.showing_date) < now,
    };
  });

  const ariaKinds = new Set<string>(ARIA_TASK_KINDS);
  type TaskRow = { title: string; due_at: string | null; kind: string | null; client_id: string | null; clients: Rel<{ name: string }> };
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const needsYou: TodayPriorities["needsYou"] = [
    ...((requestsRes.data ?? []) as { address: string | null; requested_time_text: string | null; clients: Rel<{ id: string; name: string }> }[]).map((r) => {
      const client = one(r.clients);
      return {
        clientId: client?.id ?? null,
        clientName: client?.name ?? null,
        title: `Approve showing request${r.address ? ` for ${r.address}` : ""}${r.requested_time_text ? ` (${r.requested_time_text})` : ""}`,
      };
    }),
    ...(smsEnabled ? tasks.filter((t) => ariaKinds.has(t.kind ?? "") && t.kind !== "aria_showing_approval") : []).map((t) => ({
      clientId: t.client_id,
      clientName: one(t.clients)?.name ?? null,
      title: t.title,
    })),
  ];

  const dueTasks = tasks.filter((t) => !ariaKinds.has(t.kind ?? ""));
  const tasksDue = dueTasks.slice(0, 8).map((t) => ({
    clientId: t.client_id,
    clientName: one(t.clients)?.name ?? null,
    title: t.title,
    overdue: t.due_at !== null && new Date(t.due_at) < todayStart,
  }));

  const newLeadsUncontacted = pipeline
    .filter((c) => c.createdAt >= minus7d && !IMPORT_SOURCES.has(c.source ?? "") && c.daysSinceContact === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, source: c.source, town: c.town }));

  const hotLeadsGoingQuiet = pipeline
    .filter(
      (c) =>
        ACTIVE_LEAD_STATUSES.has(c.status ?? "new") &&
        (c.leadScore ?? 0) >= 8 &&
        (c.daysSinceContact === null || c.daysSinceContact >= HOT_QUIET_AFTER_DAYS),
    )
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 3)
    .map((c) => toInsight(c, `${profilePhrase(c)}; ${daysAgoPhrase(c.daysSinceContact)}`));

  const closingsSoon = ((closingsRes.data ?? []) as { client_id: string; address: string | null; closing_date: string; clients: Rel<{ name: string }> }[]).map((t) => ({
    clientId: t.client_id,
    clientName: one(t.clients)?.name ?? null,
    address: t.address,
    daysUntil: Math.max(0, Math.round((new Date(t.closing_date).getTime() - todayStart.getTime()) / DAY_MS)),
  }));

  // Drafts → the clients they're for, hottest first.
  const draftClientIds = [...new Set(((draftsRes.data ?? []) as { client_id: string }[]).map((d) => d.client_id))];
  const draftClients = draftClientIds
    .map((id) => byId.get(id))
    .filter((c): c is PipelineClient => Boolean(c))
    .sort((a, b) => (b.leadScore ?? -1) - (a.leadScore ?? -1));
  const followUpDrafts =
    draftClientIds.length > 0
      ? { clientCount: draftClientIds.length, topClients: draftClients.slice(0, 3).map((c) => c.name) }
      : null;

  return {
    date: now.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }),
    showingsToday,
    needsYou,
    tasksDue,
    tasksDueCount: dueTasks.length,
    newLeadsUncontacted,
    hotLeadsGoingQuiet,
    closingsSoon,
    followUpDrafts,
  };
}

// ── Plain-English answers (used when the AI service is unavailable) ──────────

export type AskIntent = "hottest" | "stale" | "showings" | "today" | "drafts";

// Order matters: the first match wins.
const INTENT_PATTERNS: [AskIntent, RegExp][] = [
  ["hottest", /\b(hott?est|warmest|top|best|strongest|most (?:likely|serious|motivated|ready))\b[^?]*\b(leads?|clients?|buyers?|prospects?|sellers?)\b|\bwho(?:'s| is) (?:hot|ready to buy)\b/i],
  ["stale", /haven'?t (?:i )?(?:talked|spoken|heard|reached|contacted|texted|called|followed)|in a while|gone (?:quiet|cold|dark)|lost touch|\bstale\b|neglect|through the cracks|(?:need|should) (?:i )?(?:to )?(?:check in|reach out|follow up)/i],
  ["showings", /\bshowings?\b|\btours?\b/i],
  ["today", /\btoday\b|what should i (?:do|focus|work)|\bprioriti|\bfocus on\b|\bfirst thing\b|\bmy day\b|\bto-?do\b/i],
  ["drafts", /\bdrafts?\b|\bfollow-?ups?\b|\binbox\b/i],
];

export function detectIntent(question: string): AskIntent | null {
  for (const [intent, re] of INTENT_PATTERNS) if (re.test(question)) return intent;
  return null;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function describeHottest(r: HottestLeads, mode: "chat" | "voice" = "chat"): string {
  const [top, ...rest] = r.leads;
  if (!top) return "You don't have any active leads right now — everyone is under contract, closed, or not added yet.";
  const score = top.leadScore != null ? ` (${top.leadScore}/10)` : "";
  const lead = `Your hottest lead is ${top.name}${score} — ${lowerFirst(top.why)}.`;
  if (mode === "voice" || rest.length === 0) return lead;
  const next = rest.map((c) => `${c.name}${c.leadScore != null ? ` (${c.leadScore}/10)` : ""}`);
  return `${lead} Right behind them: ${list(next)}.`;
}

export function describeStale(r: StaleClients, mode: "chat" | "voice" = "chat"): string {
  if (r.clients.length === 0) {
    if (r.neverContactedCount > 0) {
      return `You haven't logged contact with any of your ${r.neverContactedCount} active client${r.neverContactedCount === 1 ? "" : "s"} yet — start with ${list(r.neverContacted.map((c) => c.name))}.`;
    }
    return "You don't have any active clients to check in with yet.";
  }
  const parts = r.clients.slice(0, mode === "voice" ? 2 : 3).map((c) => `${c.name} (${c.daysSinceContact} days)`);
  const quiet = r.clients[0].daysSinceContact! >= r.staleAfterDays;
  const head = quiet
    ? `You haven't talked to ${list(parts)} in a while.`
    : `Nobody's gone ${r.staleAfterDays}+ days without hearing from you — the quietest are ${list(parts)}.`;
  if (mode === "voice") return head;
  const top = r.clients[0];
  const tail = quiet
    ? ` A quick check-in with ${firstName(top.name)} would help — they're ${lowerFirst(top.why.split(";")[0])}.`
    : "";
  const never =
    r.neverContactedCount > 0
      ? ` ${r.neverContactedCount} more ${r.neverContactedCount === 1 ? "has" : "have"} no contact logged at all${r.neverContacted[0] ? `, starting with ${r.neverContacted[0].name}` : ""}.`
      : "";
  return `${head}${tail}${never}`;
}

export function describeToday(r: TodayPriorities, mode: "chat" | "voice" = "chat"): string {
  // Most time-sensitive first; each line stands on its own.
  const lines: string[] = [];
  const upcoming = r.showingsToday.filter((s) => !s.done);
  if (upcoming.length > 0) {
    const s = upcoming[0];
    const more = upcoming.length > 1 ? `, plus ${upcoming.length - 1} more later` : "";
    lines.push(`You have ${/^(8|11)\b/.test(s.time) ? "an" : "a"} ${s.time} showing at ${s.address ?? "a property"}${s.clientName ? ` with ${s.clientName}` : ""}${more}.`);
  }
  if (r.needsYou.length > 0) {
    const n = r.needsYou[0];
    lines.push(
      r.needsYou.length === 1
        ? `Aria needs you: ${lowerFirst(n.title)}${n.clientName ? ` (${n.clientName})` : ""}.`
        : `Aria needs you on ${r.needsYou.length} things, starting with: ${lowerFirst(n.title)}${n.clientName ? ` (${n.clientName})` : ""}.`,
    );
  }
  const closingNow = r.closingsSoon.filter((c) => c.daysUntil <= 1);
  for (const c of closingNow.slice(0, 1)) {
    lines.push(`${c.clientName ?? "A client"} closes ${c.daysUntil === 0 ? "today" : "tomorrow"}${c.address ? ` at ${c.address}` : ""}.`);
  }
  if (r.newLeadsUncontacted.length > 0) {
    const names = r.newLeadsUncontacted.slice(0, 2).map((l) => l.name);
    lines.push(
      names.length === 1
        ? `${names[0]} is a new lead you haven't contacted yet.`
        : `${list(names)} are new leads you haven't contacted yet.`,
    );
  }
  if (r.tasksDueCount > 0) {
    const overdue = r.tasksDue.filter((t) => t.overdue).length;
    const due = r.tasksDueCount === 1 ? "1 task is due" : `${r.tasksDueCount} tasks are due`;
    lines.push(`${due}${overdue ? ` (${overdue} overdue)` : " today"}, starting with “${r.tasksDue[0].title}”.`);
  }
  if (r.hotLeadsGoingQuiet.length > 0) {
    const h = r.hotLeadsGoingQuiet[0];
    lines.push(
      `Check in with ${h.name}, a hot lead ${h.daysSinceContact === null ? "with no contact logged yet" : `you haven't talked to in ${h.daysSinceContact} days`}.`,
    );
  }
  const closingLater = r.closingsSoon.filter((c) => c.daysUntil > 1);
  for (const c of closingLater.slice(0, 1)) {
    lines.push(`${c.clientName ?? "A client"} closes in ${c.daysUntil} days${c.address ? ` at ${c.address}` : ""}.`);
  }

  // Drafts are a background chore: last, and by who they're for — never a raw count.
  const drafts = r.followUpDrafts
    ? `follow-up drafts are ready for ${list(
        r.followUpDrafts.clientCount > r.followUpDrafts.topClients.length
          ? [...r.followUpDrafts.topClients.slice(0, 2), `${r.followUpDrafts.clientCount - Math.min(2, r.followUpDrafts.topClients.length)} others`]
          : r.followUpDrafts.topClients,
      )}`
    : null;

  if (lines.length === 0) {
    return drafts
      ? `Nothing urgent on the calendar today — a good time to clear follow-ups: ${drafts}.`
      : "Nothing urgent today: no showings, tasks due, or new leads waiting. A good day to check in with past clients.";
  }

  const shown = lines.slice(0, mode === "voice" ? 2 : 3).join(" ");
  return mode === "chat" && drafts ? `${shown} When you have a minute, ${drafts}.` : shown;
}

async function describeUpcomingShowings(
  supabase: SupabaseClient,
  agentId: string,
  now: Date,
  mode: "chat" | "voice",
): Promise<string> {
  const in7d = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const { data } = await supabase
    .from("showings")
    .select("address, showing_date, clients(name)")
    .eq("agent_id", agentId)
    .eq("status", "scheduled")
    .gte("showing_date", now.toISOString())
    .lte("showing_date", in7d)
    .order("showing_date", { ascending: true })
    .limit(5);
  const rows = (data ?? []) as { address: string | null; showing_date: string; clients: Rel<{ name: string }> }[];
  if (rows.length === 0) return "No showings scheduled in the next 7 days.";
  const shown = mode === "voice" ? 2 : 3;
  const parts = rows.slice(0, shown).map(
    (s) => `${fmtWeekday(s.showing_date)} ${fmtTime(s.showing_date)} at ${s.address ?? "a property"}${one(s.clients)?.name ? ` with ${one(s.clients)!.name}` : ""}`,
  );
  return `You have ${rows.length} showing${rows.length === 1 ? "" : "s"} this week: ${list(parts)}${rows.length > shown ? ", and more" : ""}.`;
}

export type DataAnswer = {
  reply: string;
  /** The client the answer is about, for a one-tap "open" action. */
  focusClient: { id: string; name: string } | null;
};

/**
 * Answers the common questions straight from the data, for when Claude is
 * unavailable. Anything else gets an honest "can't answer that" plus a
 * clarifying question — never an unrelated stat.
 */
export async function answerFromData(
  supabase: SupabaseClient,
  agentId: string,
  question: string,
  mode: "chat" | "voice" = "chat",
): Promise<DataAnswer> {
  const now = new Date();
  const focus = (c?: ClientInsight) => (c ? { id: c.id, name: c.name } : null);
  try {
    switch (detectIntent(question)) {
      case "hottest": {
        const r = await getHottestLeads(supabase, agentId, 3, now);
        return { reply: describeHottest(r, mode), focusClient: focus(r.leads[0]) };
      }
      case "stale": {
        const r = await getStaleClients(supabase, agentId, 5, now);
        return { reply: describeStale(r, mode), focusClient: focus(r.clients[0] ?? r.neverContacted[0]) };
      }
      case "today":
        return { reply: describeToday(await getTodayPriorities(supabase, agentId, now), mode), focusClient: null };
      case "showings":
        return { reply: await describeUpcomingShowings(supabase, agentId, now, mode), focusClient: null };
      case "drafts": {
        const d = (await getTodayPriorities(supabase, agentId, now)).followUpDrafts;
        return {
          reply: d
            ? `${d.clientCount} client${d.clientCount === 1 ? " has" : "s have"} follow-up drafts waiting — start with ${list(d.topClients)}, your hottest.`
            : "No follow-up drafts waiting — you're all caught up.",
          focusClient: null,
        };
      }
    }
  } catch (err) {
    console.error("[insights] answerFromData failed:", err);
    return { reply: "I couldn't load your data just now. Try again in a moment.", focusClient: null };
  }
  return {
    reply:
      mode === "voice"
        ? "I can't answer that one right now. Ask me about your hottest lead, who's gone quiet, or today's priorities."
        : "I can't answer that one right now — my AI connection is down, so I can only pull straight from your data. Do you want your hottest lead, who you haven't talked to in a while, or what to focus on today?",
    focusClient: null,
  };
}
