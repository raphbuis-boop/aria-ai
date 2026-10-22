import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotification } from "@/lib/notifications";
import { sendEmail, showingReminderEmail, engagementAlertEmail } from "@/lib/resend";
import { dayKey, zonedDayBounds } from "@/lib/time";
import { chunk, formatShowingWhen, latestByClient, showingDayLabel } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Showings that are actually on the calendar. Requested ones aren't confirmed
 * yet; cancelled, declined and completed ones don't need a reminder. */
const ACTIVE_SHOWING_STATUSES = ["scheduled"];

/**
 * Activities that are real contact with the client: messages and emails that
 * were sent or received, and calls/showings the agent logged as done. Unsent
 * AI drafts, automation drafts and notes don't count. (PostgREST `or` filter.)
 */
const REAL_CONTACT_FILTER =
  "and(type.in.(text,sms,whatsapp,email),or(sent.is.true,direction.eq.inbound)),and(type.in.(call,showing),sent.is.true)";

/** Today's date in the agents' zone (YYYY-MM-DD), for once-a-day dedup keys. */
function todayKey() {
  return dayKey(new Date());
}

/** Days without real contact before a client counts as stale. */
const STALE_DAYS = 21;
const USERS_PAGE_SIZE = 1000;

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
    .in("status", ACTIVE_SHOWING_STATUSES)
    .gte("showing_date", windowStart)
    .lte("showing_date", windowEnd);

  if (!showings?.length) return NextResponse.json({ processed: 0 });

  // Agent emails: agent_profiles.email, else the sign-in address.
  const agentIdSet = new Set<string>();
  for (const s of showings) agentIdSet.add(s.agent_id);
  const agentIds = Array.from(agentIdSet);
  const { data: agentRows } = await supabase
    .from("agent_profiles")
    .select("id, email, full_name")
    .in("id", agentIds);
  const profileById = new Map((agentRows ?? []).map((a) => [a.id as string, a]));
  const agentMap = new Map<string, { email: string | null; name: string }>();
  for (const id of agentIds) {
    const profile = profileById.get(id);
    let email = (profile?.email as string | null) ?? null;
    if (!email) {
      const { data } = await supabase.auth.admin.getUserById(id);
      email = data?.user?.email ?? null;
    }
    agentMap.set(id, { email, name: (profile?.full_name as string | null) ?? "Agent" });
  }

  let processed = 0;
  for (const showing of showings) {
    const showingTime = new Date(showing.showing_date).getTime();
    const hoursAway = (showingTime - now) / (60 * 60 * 1000);
    if (hoursAway < 0) continue; // already happened
    const clientName =
      (showing.clients as { name?: string } | null)?.name ?? "Client";
    const address = showing.address ?? "Property";
    const dateStr = formatShowingWhen(showing.showing_date);

    // ── Daily-cron-friendly "upcoming showing" reminder ──────────────────────
    // The Hobby-plan cron runs once a day, so exact 24h/2h threshold windows
    // (±0.5h) essentially never hit. Instead, remind once per calendar day for
    // every showing in the next ~25h. Dedup key includes the date so a showing
    // visible across two daily runs notifies once per day, not twice.
    const dayLabel = showingDayLabel(showing.showing_date, new Date(now));
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
          when: dayLabel,
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
            when: "in about 2 hours",
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
  // listUsers is paginated (50 per page by default) — walk every page.
  const allUsers: Array<{ id: string; email?: string; user_metadata?: { full_name?: string } }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) {
      console.error("[cron-trigger] listUsers failed", error.message);
      break;
    }
    allUsers.push(...data.users);
    if (data.users.length < USERS_PAGE_SIZE) break;
  }

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
      .select("id, name, agent_id, created_at")
      .eq("agent_id", user.id)
      .in("status", ["new", "contacted", "showing"]);

    if (!clients?.length) continue;

    // Completed showings count as contact too.
    const { data: completedShowings } = await supabase
      .from("showings")
      .select("client_id, showing_date")
      .eq("agent_id", user.id)
      .eq("status", "completed");
    const lastShowingAt = new Map<string, number>();
    for (const s of completedShowings ?? []) {
      const t = s.showing_date ? new Date(s.showing_date).getTime() : 0;
      if (t > (lastShowingAt.get(s.client_id) ?? 0)) lastShowingAt.set(s.client_id, t);
    }

    // Newest real contact per client, a chunk of clients per query instead of
    // one query per client. Rows come newest first, so if a chunk hits the
    // row cap only the oldest rows drop out: a recently contacted client is
    // never misread as stale (a long-stale one may show a larger day count).
    const lastContactAt = new Map(lastShowingAt);
    let contactsLoaded = true;
    for (const ids of chunk(clients.map((c) => c.id as string), 25)) {
      const { data: rows, error } = await supabase
        .from("activities")
        .select("client_id, created_at")
        .in("client_id", ids)
        .or(REAL_CONTACT_FILTER)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[cron-trigger] loading contacts failed", { agent: user.id, error: error.message });
        contactsLoaded = false;
        break;
      }
      for (const [id, t] of latestByClient(rows ?? [])) {
        if (t > (lastContactAt.get(id) ?? 0)) lastContactAt.set(id, t);
      }
    }
    // Without contact history every client would look stale — skip this agent.
    if (!contactsLoaded) continue;

    const staleClients: { name: string; days: number; id: string }[] = [];

    for (const client of clients) {
      // Never contacted → count from when the client was added.
      const lastTs = lastContactAt.get(client.id) || new Date(client.created_at).getTime();
      const days = Math.floor((now - lastTs) / DAY_MS);

      if (days >= STALE_DAYS) {
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
  // "Today" in the agents' zone — the server clock is UTC.
  const { start: todayStart, end: tomorrowStart } = zonedDayBounds(new Date(now));

  const { data: dueTasks } = await supabase
    .from("tasks")
    .select("id, agent_id, title, client_id")
    .eq("done", false)
    .gte("due_at", todayStart.toISOString())
    .lt("due_at", tomorrowStart.toISOString());

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
