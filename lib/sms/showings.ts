import type { SupabaseClient } from "@supabase/supabase-js";
import { sendClientSms } from "@/lib/sms/outbound";
import { sendBbaLinkSms } from "@/lib/sms/bba";
import { firstNameOf } from "@/lib/sms/lead";
import { openAriaTask } from "@/lib/sms/tasks";
import { createShowingEvent, findCalendarConflicts } from "@/lib/google-calendar";
import type { ShowingRequest } from "@/lib/sms/conversation";

const TZ = "America/New_York";

export function formatShowingTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function logShowingActivity(
  supabase: SupabaseClient,
  client: { id: string; agent_id: string },
  body: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("activities").insert({
    client_id: client.id,
    agent_id: client.agent_id,
    type: "showing",
    direction: "outbound",
    body,
    ai_draft: false,
    approved: true,
    sent: false,
    metadata,
  });
}

/**
 * A client asked to see a home over SMS. Records it as a `showings` row with
 * status 'requested', checks the agent's Google Calendar for a clash, and
 * opens an approval task (surfaced on Today and the client profile).
 * Nothing is booked until the agent approves.
 */
export async function createShowingRequest(
  supabase: SupabaseClient,
  client: { id: string; agent_id: string; name: string },
  request: ShowingRequest,
) {
  let address = request.address;
  if (request.property_id) {
    const { data: property } = await supabase
      .from("properties")
      .select("address")
      .eq("id", request.property_id)
      .eq("agent_id", client.agent_id)
      .maybeSingle();
    address = property?.address ?? address;
  }

  const label = address ?? "a home";
  const when = request.requested_time_iso
    ? formatShowingTime(request.requested_time_iso)
    : request.requested_time_text;

  const conflicts = request.requested_time_iso
    ? await findCalendarConflicts(client.agent_id, request.requested_time_iso)
    : null;
  const conflictNote = conflicts?.length
    ? `Calendar conflict: ${conflicts.join(", ")}.`
    : conflicts
      ? "No calendar conflicts."
      : null;

  const taskId = await openAriaTask(supabase, {
    agentId: client.agent_id,
    clientId: client.id,
    kind: "aria_showing_approval",
    unique: true,
    title: `Approve showing: ${client.name} · ${label} · ${when}`,
    notification: {
      kind: "task_due",
      title: `${client.name} wants to see ${label}`,
      body: [`Requested: ${when}.`, conflictNote, "Approve on Today or their profile."].filter(Boolean).join(" "),
    },
  });

  const { data: showing, error } = await supabase
    .from("showings")
    .insert({
      client_id: client.id,
      agent_id: client.agent_id,
      property_id: request.property_id,
      address,
      showing_date: request.requested_time_iso,
      requested_time_text: request.requested_time_text,
      status: "requested",
      notes: ["Requested by client over SMS via Aria.", conflictNote].filter(Boolean).join(" "),
      approval_task_id: taskId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await logShowingActivity(supabase, client, `Showing requested: ${label} · ${when}. Waiting on your approval.`, {
    kind: "showing_requested",
    showing_id: showing.id,
  });

  return showing.id as string;
}

type ShowingRow = {
  id: string;
  client_id: string;
  agent_id: string;
  address: string | null;
  showing_date: string | null;
  status: string;
  approval_task_id: string | null;
  clients: { id: string; agent_id: string; name: string; phone: string | null; sms_opted_out: boolean } | null;
};

async function loadRequestedShowing(
  supabase: SupabaseClient,
  showingId: string,
  agentId: string,
) {
  const { data } = await supabase
    .from("showings")
    .select(
      "id, client_id, agent_id, address, showing_date, status, approval_task_id, clients(id, agent_id, name, phone, sms_opted_out)",
    )
    .eq("id", showingId)
    .eq("agent_id", agentId)
    .maybeSingle<ShowingRow>();
  return data;
}

async function closeApprovalTask(supabase: SupabaseClient, taskId: string | null) {
  if (taskId) await supabase.from("tasks").update({ done: true }).eq("id", taskId);
}

/**
 * Agent approved an SMS showing request: schedule it, log it on the
 * timeline, add it to Google Calendar (when permitted), text the client a
 * confirmation, then text the existing BBA signing link if unsigned.
 */
export async function approveShowingRequest(
  supabase: SupabaseClient,
  agentId: string,
  showingId: string,
  showingDateIso: string | null,
) {
  const showing = await loadRequestedShowing(supabase, showingId, agentId);
  if (!showing) return { ok: false as const, status: 404, error: "Showing not found" };
  if (showing.status !== "requested") {
    return { ok: false as const, status: 409, error: `Showing is already ${showing.status}` };
  }
  const when = showingDateIso ?? showing.showing_date;
  if (!when || Number.isNaN(Date.parse(when))) {
    return { ok: false as const, status: 400, error: "Pick a date and time before approving" };
  }
  const client = showing.clients;
  if (!client) return { ok: false as const, status: 404, error: "Client not found" };
  const whenIso = new Date(when).toISOString();

  // Status guard in the update itself: two concurrent approvals can't both win.
  const { data: claimed, error } = await supabase
    .from("showings")
    .update({ status: "scheduled", showing_date: whenIso })
    .eq("id", showing.id)
    .eq("status", "requested")
    .select("id");
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!claimed?.length) return { ok: false as const, status: 409, error: "Showing was already handled" };

  await closeApprovalTask(supabase, showing.approval_task_id);
  await supabase.from("clients").update({ status: "showing" }).eq("id", client.id).in("status", ["new", "contacted"]);
  await logShowingActivity(supabase, client, `Showing scheduled: ${showing.address ?? "home"} · ${formatShowingTime(whenIso)}.`, {
    kind: "showing_scheduled",
    showing_id: showing.id,
  });

  const calendarEventId = await createShowingEvent(agentId, {
    startIso: whenIso,
    address: showing.address,
    clientName: client.name,
    clientPhone: client.phone,
  });
  if (calendarEventId) {
    await supabase.from("showings").update({ calendar_event_id: calendarEventId }).eq("id", showing.id);
  }

  const { data: agent } = await supabase
    .from("agent_profiles")
    .select("full_name")
    .eq("id", agentId)
    .maybeSingle();
  const agentName = agent?.full_name || "your agent";

  const confirmation = await sendClientSms(
    supabase,
    client,
    `Hi ${firstNameOf(client.name)} — you're confirmed to see ${showing.address ?? "the home"} on ${formatShowingTime(whenIso)} with ${agentName}. Reply here if anything changes.`,
    { aiDraft: false, metadata: { kind: "showing_confirmation", showing_id: showing.id } },
  );

  const bba = confirmation.ok ? await sendBbaLinkSms(supabase, client) : null;

  return { ok: true as const, confirmation, bba, calendarEventId };
}

export async function declineShowingRequest(
  supabase: SupabaseClient,
  agentId: string,
  showingId: string,
  message: string | null,
) {
  const showing = await loadRequestedShowing(supabase, showingId, agentId);
  if (!showing) return { ok: false as const, status: 404, error: "Showing not found" };
  if (showing.status !== "requested") {
    return { ok: false as const, status: 409, error: `Showing is already ${showing.status}` };
  }

  await supabase.from("showings").update({ status: "declined" }).eq("id", showing.id).eq("status", "requested");
  await closeApprovalTask(supabase, showing.approval_task_id);
  if (showing.clients) {
    await logShowingActivity(supabase, showing.clients, `Showing request declined: ${showing.address ?? "home"}.`, {
      kind: "showing_declined",
      showing_id: showing.id,
    });
  }

  let sms = null;
  if (message?.trim() && showing.clients) {
    sms = await sendClientSms(supabase, showing.clients, message.trim(), {
      aiDraft: false,
      metadata: { kind: "showing_declined", showing_id: showing.id },
    });
  }
  return { ok: true as const, sms };
}
