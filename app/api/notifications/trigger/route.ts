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
  if (!secret) {
    // No secret configured: allow in dev, deny in production so the route
    // can't be triggered by anyone on the internet. Set CRON_SECRET in Vercel.
    if (process.env.NODE_ENV === "production") {
      console.error("[cron-trigger] CRON_SECRET is not set — rejecting request in production");
      return false;
    }
    return true; // dev — allow all
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handleTrigger(req: Request) {
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

export async function POST(req: Request) {
  return handleTrigger(req);
}

// Vercel Cron Jobs trigger via HTTP GET — without this export every scheduled
// run 405s and no reminders ever fire.
export async function GET(req: Request) {
  return handleTrigger(req);
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
    if (hoursAway < 0) continue; // already happened
    const clientName =
      (showing.clients as { name?: string } | null)?.name ?? "Client";
    const address = showing.address ?? "Property";
    const dateStr = new Date(showing.showing_date).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    // ── Daily-cron-friendly "upcoming showing" reminder ──────────────────────
    // The Hobby-plan cron runs once a day, so exact 24h/2h threshold windows
    // (±0.5h) essentially never hit. Instead, remind once per calendar day for
    // every showing in the next ~25h. Dedup key includes the date so a showing
    // visible across two daily runs notifies once per day, not twice.
    const dayLabel = hoursAway <= 12 ? "today" : "tomorrow";
    const upcomingDedup = `showing_reminder::${showing.id}::upcoming::${todayKey()}`;
    await insertNotification(supabase, {
      agent_id: showing.agent_id,
      kind: "showing_reminder",
      title: `Showing ${dayLabel}: ${address}`,
      body: `${clientName} · ${dateStr}`,
      related_client_id: showing.client_id,
      dedup_key: upcomingDedup,
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
          hoursAway: Math.round(hoursAway),
        }),
      });
    }
    processed++;

    // ── Precise 2h reminder (needs a frequent cron, e.g. hourly on Pro) ──────
    // Kept for setups with sub-daily schedules; harmless on the daily cron
    // because the window essentially never matches there.
    if (hoursAway <= 2.5 && hoursAway >= 1.5) {
      const dedup = `showing_reminder::${showing.id}::2h`;
      await insertNotification(supabase, {
        agent_id: showing.agent_id,
        kind: "showing_reminder",
        title: `Showing in 2 hours: ${address}`,
        body: `${clientName} · ${dateStr}`,
        related_client_id: showing.client_id,
        dedup_key: dedup,
      });

      if (agent?.email) {
        await sendEmail({
          to: agent.email,
          subject: `Showing in 2 hours: ${address}`,
          html: showingReminderEmail({
            agentName: agent.name,
            address,
            clientName,
            showingDate: dateStr,
            hoursAway: 2,
          }),
        });
      }
      processed++;
    }
  }

  return NextResponse.json({ processed });
}

// ─── Daily: engagement alerts + task due ──────────────────────────────────────

async function runDaily(supabase: ReturnType<typeof createAdminClient>, now: number) {
  let processed = 0;

  // ── Engagement alerts ──
  // The cron runs once a day (see vercel.json — 12:00 UTC, 7–8 AM ET), so
  // every agent who hasn't turned the digest off gets it on that run.
  const { data: agents } = await supabase.auth.admin.listUsers();
  const allUsers = agents?.users ?? [];

  const { data: prefRows } = await supabase
    .from("agent_profiles")
    .select("id, notify_followups")
    .in("id", allUsers.map((u) => u.id));
  const prefsById = new Map(
    (prefRows ?? []).map((p) => [
      p.id as string,
      {
        notifyFollowups: (p.notify_followups as boolean | null) ?? true,
      },
    ]),
  );

  const userList = allUsers.filter((u) => prefsById.get(u.id)?.notifyFollowups ?? true);

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
