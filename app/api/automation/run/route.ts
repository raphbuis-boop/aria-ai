import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { generateInboxSmsDraft, type ClientDraftContext } from "@/lib/inbox-drafts";
import { isBulkImported } from "@/lib/client-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The drip only runs for people who are actively a lead. */
const ACTIVE_LEAD_STATUSES = ["new", "contacted", "active", "showing"];

/** Claude drafts run this many at a time… */
const CONCURRENCY = 4;
/** …for at most this many clients per run; the rest are picked up on the next app open. */
const MAX_PER_RUN = 40;
/** Stop starting new clients after this long, well inside maxDuration. */
const TIME_BUDGET_MS = 40_000;

type Step = { day: number; kind: "welcome" | "followup_email" | "reengage" | "checkin_task" | "requalify_task" };

const STEPS: Step[] = [
  { day: 1, kind: "welcome" },
  { day: 2, kind: "followup_email" },
  { day: 5, kind: "checkin_task" },
  { day: 14, kind: "reengage" },
  { day: 30, kind: "requalify_task" },
];

type ClientRow = {
  id: string;
  name: string;
  status: string | null;
  town: string | null;
  budget_min: number | null;
  budget_max: number | null;
  last_engagement_at: string | null;
  created_at: string;
  automation_day: number | null;
  last_automation_at: string | null;
  source: string | null;
  lead_source: string | null;
  contact_group: string | null;
};

/**
 * POST /api/automation/run — the new-lead drip (welcome draft day 1, email
 * draft day 2, check-in task day 5, re-engage draft day 14, re-qualify task
 * day 30). Runs when the agent opens the app.
 *
 * - Only active leads (status new/contacted/active/showing). Never sphere or
 *   past clients, never bulk imports, never closed clients.
 * - Idempotent: each client's next step is claimed with a conditional update
 *   on (automation_day, last_automation_at) before anything is written, so two
 *   tabs racing can't both create the same draft.
 * - Bounded: Claude drafts run a few at a time, for a capped number of clients
 *   and a time budget; anything left is done on the next run.
 */
export async function POST() {
  const startedAt = Date.now();
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, status, town, budget_min, budget_max, last_engagement_at, created_at, automation_day, last_automation_at, source, lead_source, contact_group")
    .eq("agent_id", user.id)
    .in("status", ACTIVE_LEAD_STATUSES)
    .lt("automation_day", STEPS[STEPS.length - 1].day)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[automation/run] load failed", error.message);
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  const now = Date.now();
  const due: { client: ClientRow; step: Step }[] = [];
  for (const c of (clients ?? []) as ClientRow[]) {
    if (isBulkImported(c) || c.contact_group === "sphere" || c.contact_group === "past_client") continue;
    const daysSince = Math.floor((now - new Date(c.created_at).getTime()) / DAY_MS);
    const automationDay = c.automation_day ?? 0;
    const lastAt = c.last_automation_at ? new Date(c.last_automation_at).getTime() : 0;
    if (now - lastAt <= DAY_MS * 0.9) continue;
    const step = STEPS.find((s) => daysSince >= s.day && automationDay < s.day);
    if (step) due.push({ client: c, step });
  }

  const batch = due.slice(0, MAX_PER_RUN);
  let processed = 0;
  let next = 0;

  async function runOne({ client: c, step }: { client: ClientRow; step: Step }) {
    // Claim the step: only one request can move this client from its current state.
    let claim = supabase
      .from("clients")
      .update({ automation_day: step.day, last_automation_at: new Date().toISOString() })
      .eq("id", c.id)
      .eq("agent_id", user!.id)
      .eq("automation_day", c.automation_day ?? 0);
    claim = c.last_automation_at ? claim.eq("last_automation_at", c.last_automation_at) : claim.is("last_automation_at", null);
    const { data: claimed } = await claim.select("id");
    if (!claimed?.length) return; // another tab got here first

    try {
      if (step.kind === "checkin_task" || step.kind === "requalify_task") {
        await supabase.from("tasks").insert({
          client_id: c.id,
          agent_id: user!.id,
          title: step.kind === "checkin_task" ? `5-day check-in: ${c.name}` : `Archive / re-qualify: ${c.name}`,
          due_at: new Date(Date.now() + (step.kind === "requalify_task" ? DAY_MS * 3 : 0)).toISOString(),
          ai_generated: true,
          done: false,
        });
      } else {
        const ctx: ClientDraftContext = {
          name: c.name,
          status: c.status,
          town: c.town,
          budget_min: c.budget_min,
          budget_max: c.budget_max,
          last_engagement_at: c.last_engagement_at,
        };
        const body = await generateInboxSmsDraft(ctx, step.kind);
        await supabase.from("activities").insert({
          client_id: c.id,
          agent_id: user!.id,
          type: step.kind === "followup_email" ? "email" : "automation",
          body,
          ai_draft: true,
          approved: false,
          sent: false,
        });
      }
      processed += 1;
    } catch (err) {
      // The step stays claimed — better a skipped draft than a retry storm.
      console.error("[automation/run] step failed", c.id, step.kind, err instanceof Error ? err.message : err);
    }
  }

  async function worker() {
    while (next < batch.length && Date.now() - startedAt < TIME_BUDGET_MS) {
      await runOne(batch[next++]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

  return NextResponse.json({ processed, remaining: due.length - next });
}
