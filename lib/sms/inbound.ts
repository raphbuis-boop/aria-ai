import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotification } from "@/lib/notifications";
import {
  draftConversationReply,
  extractProfileUpdates,
  type ClientProfile,
  type ProfileUpdates,
  type ThreadMessage,
} from "@/lib/sms/conversation";
import { sendClientSms } from "@/lib/sms/outbound";
import { findCandidateProperties, recordRecommendations } from "@/lib/sms/recommend";
import { createShowingRequest } from "@/lib/sms/showings";
import { hasSignedBba } from "@/lib/sms/bba";
import { openAriaTask } from "@/lib/sms/tasks";
import { defaultLeadAgentId } from "@/lib/sms/lead-auth";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_WORDS = new Set(["start", "unstop", "yes"]);
/** Loop guard: never auto-reply more than this many times per client per day. */
const MAX_AUTO_REPLIES_PER_DAY = 25;
/** Placeholder name for someone who texted in before telling us who they are. */
const UNKNOWN_NAME_PREFIX = "New lead";

type ClientRow = ClientProfile & {
  id: string;
  agent_id: string;
  phone: string | null;
  status: string | null;
  sms_opted_out: boolean;
  aria_paused: boolean;
  nearby_towns_ok: boolean | null;
  budget_flex_pct: number | null;
  bed_flex: number | null;
  bath_flex: number | null;
};

const CLIENT_COLUMNS =
  "id, agent_id, name, phone, status, sms_opted_out, aria_paused, town, preferred_towns, budget_min, budget_max, beds_wanted, baths_wanted, timeline, notes, nearby_towns_ok, budget_flex_pct, bed_flex, bath_flex";

export type InboundWork = { clientId: string; activityId: string; body: string };

/**
 * Step 1 (fast, inside the webhook): dedupe on MessageSid, find the client
 * (or create one when a new person texts the Aria number), log the text,
 * handle STOP/START and paused threads. Returns the work to finish after the
 * webhook has responded, or null if Aria shouldn't reply.
 */
export async function recordInboundSms(params: Record<string, string>): Promise<InboundWork | null> {
  const from = params.From?.trim() ?? "";
  const to = params.To?.trim() ?? "";
  const body = params.Body?.trim() ?? "";
  const messageSid = params.MessageSid?.trim() ?? "";
  if (!from || !body) return null;

  const supabase = createAdminClient();

  if (messageSid) {
    const { data: duplicate } = await supabase
      .from("activities").select("id").eq("external_id", messageSid).maybeSingle();
    if (duplicate) return null;
  }

  // If the texted number belongs to one agent, only consider their clients.
  const { data: owningAgent } = to
    ? await supabase.from("agent_profiles").select("id").eq("twilio_from_number", to).maybeSingle()
    : { data: null };

  let query = supabase.from("clients").select(CLIENT_COLUMNS).eq("phone", from);
  if (owningAgent) query = query.eq("agent_id", owningAgent.id);
  const { data: found } = await query
    .order("last_engagement_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<ClientRow>();

  const client = found ?? (await createTextInLead(supabase, from, owningAgent?.id ?? defaultLeadAgentId()));
  if (!client) {
    console.warn("[sms/inbound] unknown sender and no agent to assign", { messageSid });
    return null;
  }

  const { data: logged, error: insertError } = await supabase
    .from("activities")
    .insert({
      client_id: client.id,
      agent_id: client.agent_id,
      type: "text",
      direction: "inbound",
      body,
      ai_draft: false,
      approved: true,
      sent: true,
      external_id: messageSid || null,
      metadata: { channel: "twilio" },
    })
    .select("id")
    .single();
  // 23505: Twilio retried and a concurrent request already logged it.
  if (insertError?.code === "23505") return null;
  if (insertError || !logged) throw insertError ?? new Error("inbound insert failed");

  await supabase
    .from("clients")
    .update({ last_engagement_at: new Date().toISOString() })
    .eq("id", client.id);

  const keyword = body.toLowerCase().replace(/[^a-z]/g, "");
  if (STOP_WORDS.has(keyword)) {
    // Twilio sends the carrier-required opt-out confirmation itself.
    await supabase.from("clients").update({ sms_opted_out: true }).eq("id", client.id);
    return null;
  }
  if (client.sms_opted_out) {
    if (START_WORDS.has(keyword)) {
      await supabase.from("clients").update({ sms_opted_out: false }).eq("id", client.id);
    }
    return null;
  }

  if (client.aria_paused) {
    // Agent has taken over this thread; make sure they see the new text.
    await openAriaTask(supabase, {
      agentId: client.agent_id,
      clientId: client.id,
      kind: "aria_client_texted",
      title: `Reply to ${client.name} (Aria is paused)`,
      notification: {
        kind: "engagement_alert",
        title: `${client.name} texted`,
        body: body.slice(0, 200),
      },
    });
    return null;
  }

  return { clientId: client.id, activityId: logged.id as string, body };
}

/** Someone texted the Aria number who isn't a client yet: that's a lead. */
async function createTextInLead(
  supabase: SupabaseClient,
  phone: string,
  agentId: string | null,
): Promise<ClientRow | null> {
  if (!agentId) return null;
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      agent_id: agentId,
      name: `${UNKNOWN_NAME_PREFIX} ${phone}`,
      phone,
      source: "other",
      lead_source: "sms",
      status: "new",
      client_role: "buyer",
    })
    .select(CLIENT_COLUMNS)
    .single<ClientRow>();
  if (error || !client) {
    console.error("[sms/inbound] could not create text-in lead", error?.message);
    return null;
  }
  await supabase.from("activities").insert({
    client_id: client.id,
    agent_id: agentId,
    type: "note",
    direction: "inbound",
    body: "New lead (text message): texted the Aria number.",
    ai_draft: false,
    approved: true,
    sent: false,
    metadata: { kind: "lead_intake", source: "sms" },
  });
  await insertNotification(supabase, {
    agent_id: agentId,
    kind: "inquiry_received",
    title: `New lead texted in: ${phone}`,
    body: "Aria is replying now.",
    related_client_id: client.id,
  });
  return client;
}

/** Newest inbound text for the client — used to answer only the latest
 * message when several arrive in quick succession. */
async function latestInboundId(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase
    .from("activities")
    .select("id")
    .eq("client_id", clientId)
    .eq("type", "text")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Step 2 (after the webhook responds): Claude reads the reply, updates the
 * profile, picks matching homes, drafts and sends Aria's answer, and opens a
 * showing request for the agent if the client asked for one.
 */
export async function respondToInboundSms(work: InboundWork) {
  const supabase = createAdminClient();

  // A newer text already arrived; its run answers both.
  if ((await latestInboundId(supabase, work.clientId)) !== work.activityId) return;

  const { data: loaded } = await supabase
    .from("clients").select(CLIENT_COLUMNS).eq("id", work.clientId).single<ClientRow>();
  if (!loaded || loaded.aria_paused || loaded.sms_opted_out) return;
  let client = loaded;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: repliesToday } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("direction", "outbound")
    .eq("ai_draft", true)
    .gte("created_at", since);
  if ((repliesToday ?? 0) >= MAX_AUTO_REPLIES_PER_DAY) {
    await pauseForAgent(supabase, client, "aria_handoff", "Aria hit its daily reply limit", work.body);
    return;
  }

  const { data: rows } = await supabase
    .from("activities")
    .select("id, direction, body, created_at, metadata")
    .eq("client_id", client.id)
    .in("type", ["text", "note", "showing"])
    .order("created_at", { ascending: false })
    .limit(30);
  const recent = (rows ?? []).reverse();
  // Everything up to (not including) the messages Aria is answering now.
  const unanswered = trailingInbound(recent);
  const latestMessage = unanswered.map((r) => r.body).join("\n");
  const history: ThreadMessage[] = recent
    .slice(0, recent.length - unanswered.length)
    .map((r) => ({ direction: r.direction, body: r.body, at: r.created_at }));

  // 1. Understand the reply → update the client profile.
  const updates = await extractProfileUpdates({ profile: profileOf(client), history, latestMessage });
  if (updates) client = await applyProfileUpdates(supabase, client, updates);

  // 2. Pick matching homes from the agent's real inventory.
  const alreadySent = new Set<string>(
    recent.flatMap((r) => (r.metadata?.recommended_property_ids as string[] | undefined) ?? []),
  );
  const candidates = await findCandidateProperties(supabase, client, alreadySent);

  const [{ data: showings }, { data: agent }, bbaSigned] = await Promise.all([
    supabase
      .from("showings")
      .select("address, showing_date, requested_time_text, status")
      .eq("client_id", client.id)
      .in("status", ["requested", "scheduled"]),
    supabase.from("agent_profiles").select("full_name").eq("id", client.agent_id).maybeSingle(),
    hasSignedBba(supabase, client.id),
  ]);

  // 3. Draft Aria's reply.
  const reply = await draftConversationReply({
    agentName: agent?.full_name || "your agent",
    now: new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" }),
    profile: profileOf(client),
    history,
    latestMessage,
    candidates,
    openShowingRequests: (showings ?? []).filter((s) => s.status === "requested"),
    upcomingShowings: (showings ?? []).filter((s) => s.status === "scheduled"),
    bbaSigned,
  });

  if (!reply) {
    await openAriaTask(supabase, {
      agentId: client.agent_id,
      clientId: client.id,
      kind: "aria_reply_failed",
      title: `Reply to ${client.name} — Aria couldn't draft a response`,
      notification: { kind: "engagement_alert", title: `Aria needs you to reply to ${client.name}`, body: latestMessage.slice(0, 200) },
    });
    return;
  }

  // Another text landed while Claude was thinking — let that run answer.
  if ((await latestInboundId(supabase, work.clientId)) !== work.activityId) return;

  // 4. Showing request → approval card for the agent.
  let showingId: string | null = null;
  if (reply.showing_request) {
    try {
      showingId = await createShowingRequest(supabase, client, reply.showing_request);
    } catch (error) {
      console.error("[sms/inbound] showing request failed", error);
    }
  }

  // 5. Send it.
  const recommended = candidates.filter((c) => reply.recommended_property_ids.includes(c.id));
  const sent = await sendClientSms(supabase, client, reply.smsBody, {
    metadata: {
      kind: "ai_reply",
      intent: reply.intent,
      rationale: reply.rationale,
      recommended_property_ids: recommended.map((c) => c.id),
      showing_id: showingId,
    },
  });
  if (sent.ok) await recordRecommendations(supabase, client, recommended);

  if (reply.intent === "handoff") {
    await pauseForAgent(supabase, client, "aria_handoff", `${client.name} needs you personally`, latestMessage);
  } else if (!sent.ok) {
    await openAriaTask(supabase, {
      agentId: client.agent_id,
      clientId: client.id,
      kind: "aria_send_failed",
      title: `Aria's text to ${client.name} didn't send`,
      notification: { kind: "engagement_alert", title: `Text to ${client.name} failed`, body: sent.error },
    });
  }
}

/** Inbound texts at the end of the thread that Aria hasn't answered yet. */
function trailingInbound<T extends { direction: string | null; body: string | null; metadata: unknown }>(rows: T[]): T[] {
  const out: T[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const isInboundText = r.direction === "inbound" && (r.metadata as { kind?: string } | null)?.kind !== "lead_intake";
    if (!isInboundText) break;
    out.unshift(r);
  }
  return out;
}

async function pauseForAgent(
  supabase: SupabaseClient,
  client: ClientRow,
  kind: "aria_handoff",
  title: string,
  message: string,
) {
  await supabase.from("clients").update({ aria_paused: true }).eq("id", client.id);
  await openAriaTask(supabase, {
    agentId: client.agent_id,
    clientId: client.id,
    kind,
    title: `${title} — Aria paused`,
    notification: { kind: "engagement_alert", title, body: `${client.name}: ${message}`.slice(0, 300) },
  });
}

function profileOf(c: ClientRow): ClientProfile {
  return {
    name: c.name,
    town: c.town,
    preferred_towns: c.preferred_towns,
    budget_min: c.budget_min,
    budget_max: c.budget_max,
    beds_wanted: c.beds_wanted,
    baths_wanted: c.baths_wanted,
    timeline: c.timeline,
    notes: c.notes,
  };
}

async function applyProfileUpdates(
  supabase: SupabaseClient,
  client: ClientRow,
  u: ProfileUpdates,
): Promise<ClientRow> {
  const patch: Partial<ClientRow> = {};
  if (u.full_name?.trim() && client.name.startsWith(UNKNOWN_NAME_PREFIX)) patch.name = u.full_name.trim();
  if (u.budget_min != null && u.budget_min > 0) patch.budget_min = u.budget_min;
  if (u.budget_max != null && u.budget_max > 0) patch.budget_max = u.budget_max;
  if (u.preferred_towns?.length) {
    patch.preferred_towns = u.preferred_towns;
    patch.town = u.preferred_towns[0];
  }
  if (u.beds_wanted != null && u.beds_wanted > 0) patch.beds_wanted = u.beds_wanted;
  if (u.baths_wanted != null && u.baths_wanted > 0) patch.baths_wanted = u.baths_wanted;
  if (u.timeline) patch.timeline = u.timeline;
  if (u.new_note) {
    const stamp = new Date().toISOString().slice(0, 10);
    patch.notes = [client.notes, `[${stamp} via SMS] ${u.new_note}`].filter(Boolean).join("\n");
  }
  if (Object.keys(patch).length === 0) return client;

  const { error } = await supabase.from("clients").update(patch).eq("id", client.id);
  if (error) {
    console.error("[sms/inbound] profile update failed", error.message);
    return client;
  }
  return { ...client, ...patch };
}
