import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotification } from "@/lib/notifications";
import { sendEmail, showingReminderEmail, engagementAlertEmail } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev — allow all
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "daily";

  const supabase = createAdminClient();
  const now = Date.now();

  if (type === "showing_reminders") {
    return runShowingReminders(supabase, now);
  }
  if (type === "daily") {
    return runDaily(supabase, now);
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}

// ─── Showing reminders ────────────────────────────────────────────────────────

async function runShowingReminders(supabase: ReturnType<typeof createAdminClient>, now: number) {
  const windowStart = new Date(now).toISOString();
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString(); // next 25h

  const { data: showings } = await supabase
    .from("showings")
    .select("id, agent_id, client_id, address, showing_date, clients(name)")
    .gte("showing_date", windowStart)
    .lte("showing_date", windowEnd);

  if (!showings?.length) return NextResponse.json({ processed: 0 });

  // Get agent emails
  const agentIdSet = new Set<string>();
  for (const s of showings) agentIdSet.add(s.agent_id);
  const agentIds = Array.from(agentIdSet);
  const { data: agentRows } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", agentIds);
  const agentMap = new Map(
    (agentRows ?? []).map((a) => [a.id, { email: a.email, name: a.full_name ?? "Agent" }]),
  );

  let processed = 0;
  for (const showing of showings) {
    const showingTime = new Date(showing.showing_date).getTime();
    const hoursAway = (showingTime - now) / (60 * 60 * 1000);
    const clientName =
      (showing.clients as { name?: string } | null)?.name ?? "Client";
    const address = showing.address ?? "Property";

    for (const [label, threshold] of [
      ["24h", 24],
      ["2h", 2],
    ] as [string, number][]) {
      if (hoursAway <= threshold + 0.5 && hoursAway >= threshold - 0.5) {
        const dedup = `showing_reminder::${showing.id}::${label}`;
        const dateStr = new Date(showing.showing_date).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        await insertNotification(supabase, {
          agent_id: showing.agent_id,
          kind: "showing_reminder",
          title: `Showing ${label === "2h" ? "in 2 hours" : "tomorrow"}: ${address}`,
          body: `${clientName} · ${dateStr}`,
          related_client_id: showing.client_id,
          dedup_key: dedup,
        });

        const agent = agentMap.get(showing.agent_id);
        if (agent?.email) {
          await sendEmail({
            to: agent.email,
            subject: `Showing reminder: ${address}`,
            html: showingReminderEmail({
              agentName: agent.name,
              address,
              clientName,
              showingDate: dateStr,
              hoursAway: threshold,
            }),
          });
        }

        processed++;
      }
    }
  }

  return NextResponse.json({ processed });
}

// ─── Daily: engagement alerts + task due ──────────────────────────────────────

async function runDaily(supabase: ReturnType<typeof createAdminClient>, now: number) {
  let processed = 0;

  // ── Engagement alerts ──
  const { data: agents } = await supabase.auth.admin.listUsers();
  const userList = agents?.users ?? [];

  for (const user of userList) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, agent_id")
      .eq("agent_id", user.id)
      .in("status", ["new", "contacted", "showing"]);

    if (!clients?.length) continue;

    const staleClients: { name: string; days: number; id: string }[] = [];

    for (const client of clients) {
      const { data: latest } = await supabase
        .from("activities")
        .select("created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastTs = latest?.created_at
        ? new Date(latest.created_at).getTime()
        : 0;
      const days = Math.floor((now - lastTs) / DAY_MS);

      if (days >= 21) {
        const dedup = `engagement_alert::${client.id}::${todayKey()}`;
        await insertNotification(supabase, {
          agent_id: user.id,
          kind: "engagement_alert",
          title: `${client.name} hasn't been contacted in ${days} days`,
          body: "Recommend sending a follow-up message.",
          related_client_id: client.id,
          dedup_key: dedup,
        });
        staleClients.push({ name: client.name, days, id: client.id });
        processed++;
      }
    }

    // Send one digest email if there are stale clients
    if (staleClients.length > 0 && user.email) {
      await sendEmail({
        to: user.email,
        subject: `${staleClients.length} client${staleClients.length === 1 ? "" : "s"} need follow-up`,
        html: engagementAlertEmail({
          agentName: user.user_metadata?.full_name ?? "Agent",
          clients: staleClients,
        }),
      });
    }
  }

  // ── Task due ──
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const { data: dueTasks } = await supabase
    .from("tasks")
    .select("id, agent_id, title, client_id")
    .eq("done", false)
    .gte("due_at", todayStart)
    .lte("due_at", todayEnd);

  for (const task of dueTasks ?? []) {
    const dedup = `task_due::${task.id}::${todayKey()}`;
    await insertNotification(supabase, {
      agent_id: task.agent_id,
      kind: "task_due",
      title: `Task due today: ${task.title}`,
      related_client_id: task.client_id ?? null,
      dedup_key: dedup,
    });
    processed++;
  }

  return NextResponse.json({ processed });
}
