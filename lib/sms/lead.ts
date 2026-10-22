import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPhoneE164 } from "@/lib/utils";
import { insertNotification } from "@/lib/notifications";
import { draftFirstTouchSms } from "@/lib/sms/conversation";
import { sendClientSms, type SendResult } from "@/lib/sms/outbound";
import { ariaSmsEnabled } from "@/lib/feature-flags";
import { clientSourceFor, type LeadSource } from "@/lib/sms/lead-sources";

export type LeadInput = {
  agentId: string;
  source: LeadSource;
  name: string;
  phone: string | null;
  email?: string | null;
  message?: string | null;
  town?: string | null;
  budgetMax?: number | null;
  propertyAddress?: string | null;
  providerEventId?: string | null;
  /** true → Aria may text this lead: they gave SMS consent, or the agent
   * vouches for it. Anything else (missing included) → create and log the
   * lead without texting. Consent is never assumed. */
  autoText?: boolean;
  /** Extra profile fields an agent fills in when adding a client by hand.
   * Only used when a new client is created. */
  profile?: {
    preferredTowns?: string[] | null;
    budgetMin?: number | null;
    bedsWanted?: number | null;
    bathsWanted?: number | null;
    notes?: string | null;
    clientRole?: "buyer" | "seller";
  };
};

export type LeadResult = {
  clientId: string;
  created: boolean;
  duplicate: boolean;
  firstText: FirstTextResult;
};

/** null → not sent because the client is already in an Aria text thread. */
export type FirstTextResult = SendResult | { ok: false; activityId: null; error: string } | null;

const CLIENT_COLUMNS = "id, agent_id, name, phone, email, sms_opted_out, town";

/**
 * A lead came in (website, Zillow, Realtor.com, Meta, referral, manual…).
 * Finds the agent's existing client by phone (then email) or creates one,
 * logs the inquiry on the timeline, notifies the agent, and has Aria send
 * the first text over Twilio.
 *
 * - A provider redelivery (same providerEventId) is a no-op.
 * - Clients already mid-thread don't get a second intro text.
 * - Agent-added ("manual") leads: a name alone is enough, a match on an
 *   existing client is returned as-is, and the agent isn't notified of
 *   their own entry.
 */
export async function ingestLead(
  supabase: SupabaseClient,
  input: LeadInput,
): Promise<LeadResult> {
  const rawPhone = input.phone?.trim() ?? "";
  const phone = rawPhone ? formatPhoneE164(rawPhone) : null;
  const email = input.email?.trim().toLowerCase() || null;
  if (rawPhone && !phone && !email) {
    throw new LeadError("Phone number isn't a valid US number", 400);
  }
  const manual = input.source === "manual";
  if (!phone && !email && !manual) throw new LeadError("A phone number or email is required", 400);
  const name = input.name.trim() || email || phone || "";
  if (name.length < 2) throw new LeadError("Name is required", 400);

  const eventKey = input.providerEventId ? `lead:${input.source}:${input.providerEventId}` : null;
  if (eventKey) {
    const { data: seen } = await supabase
      .from("activities")
      .select("client_id")
      .eq("external_id", eventKey)
      .maybeSingle();
    if (seen) return { clientId: seen.client_id as string, created: false, duplicate: true, firstText: null };
  }

  let client = null as null | {
    id: string; agent_id: string; name: string; phone: string | null;
    email: string | null; sms_opted_out: boolean; town: string | null;
  };
  if (phone) {
    const { data } = await supabase
      .from("clients").select(CLIENT_COLUMNS)
      .eq("agent_id", input.agentId).eq("phone", phone)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    client = data;
  }
  if (!client && email) {
    const { data } = await supabase
      .from("clients").select(CLIENT_COLUMNS)
      .eq("agent_id", input.agentId).ilike("email", email)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    client = data;
    // Fill in a phone the existing record was missing.
    if (client && phone && !client.phone) {
      await supabase.from("clients").update({ phone }).eq("id", client.id);
      client = { ...client, phone };
    }
  }

  const created = !client;
  if (client && manual) {
    return { clientId: client.id, created: false, duplicate: true, firstText: null };
  }
  if (!client) {
    const town = input.town?.trim() || null;
    const profile = input.profile ?? {};
    const { data, error } = await supabase
      .from("clients")
      .insert({
        agent_id: input.agentId,
        name,
        phone,
        email,
        source: clientSourceFor(input.source),
        lead_source: input.source,
        status: "new",
        client_role: profile.clientRole ?? "buyer",
        town,
        preferred_towns: profile.preferredTowns?.length ? profile.preferredTowns : town ? [town] : null,
        budget_min: profile.budgetMin ?? null,
        budget_max: input.budgetMax ?? null,
        beds_wanted: profile.bedsWanted ?? null,
        baths_wanted: profile.bathsWanted ?? null,
        notes: profile.notes ?? null,
      })
      .select(CLIENT_COLUMNS)
      .single();
    if (error || !data) throw new LeadError(error?.message ?? "Could not create client", 500);
    client = data;
  }

  const inquiry = [
    input.propertyAddress && `Asked about ${input.propertyAddress}.`,
    input.message?.trim(),
  ].filter(Boolean).join(" ");
  const { error: intakeError } = await supabase.from("activities").insert({
    client_id: client.id,
    agent_id: client.agent_id,
    type: "note",
    direction: "inbound",
    body: `New lead (${sourceLabel(input.source)})${inquiry ? `: ${inquiry}` : "."}`,
    ai_draft: false,
    approved: true,
    sent: false,
    external_id: eventKey,
    // What the lead source said about SMS consent when the lead arrived.
    metadata: { kind: "lead_intake", source: input.source, sms_consent: input.autoText === true },
  });
  // 23505: a concurrent redelivery of the same provider event won the race.
  if (intakeError?.code === "23505") {
    return { clientId: client.id, created, duplicate: true, firstText: null };
  }

  if (!manual) {
    await insertNotification(supabase, {
      agent_id: client.agent_id,
      kind: "inquiry_received",
      title: created ? `New lead: ${client.name}` : `${client.name} inquired again`,
      body: inquiry || `Source: ${sourceLabel(input.source)}.`,
      related_client_id: client.id,
    });
  }

  if (input.autoText !== true) {
    return {
      clientId: client.id, created, duplicate: false,
      firstText: notTexted("Not texted: no SMS consent for this lead"),
    };
  }
  const firstText = await sendFirstTouch(supabase, client, {
    source: input.source,
    message: input.message ?? null,
    propertyAddress: input.propertyAddress ?? null,
  });
  return { clientId: client.id, created, duplicate: false, firstText };
}

const notTexted = (error: string) => ({ ok: false as const, activityId: null, error });

/**
 * Aria's first text to a client: drafted by Claude, sent over Twilio, and the
 * client moved from "new" to "contacted". Used for new leads and when the
 * agent asks Aria to start texting an existing client. Callers decide
 * consent; this checks the flag, phone, opt-out (in sendClientSms) and that
 * the client isn't already in a text thread.
 */
export async function sendFirstTouch(
  supabase: SupabaseClient,
  client: { id: string; agent_id: string; name: string; phone: string | null; sms_opted_out?: boolean | null; town: string | null },
  context: { source: LeadSource; message?: string | null; propertyAddress?: string | null },
): Promise<FirstTextResult> {
  if (!ariaSmsEnabled()) return notTexted("Not texted: Aria texting is off");
  if (!client.phone) return notTexted("Not texted: lead has no phone number");

  const { data: priorText } = await supabase
    .from("activities").select("id")
    .eq("client_id", client.id).eq("type", "text")
    .limit(1).maybeSingle();
  if (priorText) return null;

  const { data: agent } = await supabase
    .from("agent_profiles").select("full_name")
    .eq("id", client.agent_id).maybeSingle();

  const body = await draftFirstTouchSms({
    agentName: agent?.full_name || "your agent",
    clientFirstName: firstNameOf(client.name),
    source: sourceLabel(context.source),
    leadMessage: context.message ?? null,
    town: client.town,
    propertyAddress: context.propertyAddress ?? null,
  });
  if (!body) return notTexted("Claude could not draft the first text");

  const firstText = await sendClientSms(supabase, client, body, {
    metadata: { kind: "first_touch" },
  });
  if (firstText.ok) {
    await supabase.from("clients").update({ status: "contacted" }).eq("id", client.id).eq("status", "new");
  }
  return firstText;
}

export function firstNameOf(name: string): string {
  return name.replace(/\[[^\]]*\]/g, "").trim().split(/\s+/)[0] || "there";
}

function sourceLabel(source: LeadSource): string {
  return (
    { website: "website", zillow: "Zillow", realtor: "Realtor.com", meta: "Meta ad",
      google: "Google", referral: "referral", manual: "added by agent", sms: "text message",
      other: "other" } as Record<LeadSource, string>
  )[source];
}

export class LeadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
