import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPhoneE164 } from "@/lib/utils";
import { insertNotification } from "@/lib/notifications";
import { draftFirstTouchSms } from "@/lib/sms/conversation";
import { sendClientSms, type SendResult } from "@/lib/sms/outbound";
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
  /** false → create/log the lead but don't text (e.g. no SMS consent). */
  autoText?: boolean;
};

export type LeadResult = {
  clientId: string;
  created: boolean;
  duplicate: boolean;
  firstText: SendResult | { ok: false; activityId: null; error: string } | null;
};

const CLIENT_COLUMNS = "id, agent_id, name, phone, email, sms_opted_out, town";

/**
 * A lead came in (website, Zillow, Realtor.com, Meta, referral, manual…).
 * Finds the agent's existing client by phone (then email) or creates one,
 * logs the inquiry on the timeline, notifies the agent, and has Aria send
 * the first text over Twilio.
 *
 * - A provider redelivery (same providerEventId) is a no-op.
 * - Clients already mid-thread don't get a second intro text.
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
  if (!phone && !email) throw new LeadError("A phone number or email is required", 400);
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
  if (!client) {
    const town = input.town?.trim() || null;
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
        client_role: "buyer",
        town,
        preferred_towns: town ? [town] : null,
        budget_max: input.budgetMax ?? null,
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
    metadata: { kind: "lead_intake", source: input.source },
  });
  // 23505: a concurrent redelivery of the same provider event won the race.
  if (intakeError?.code === "23505") {
    return { clientId: client.id, created, duplicate: true, firstText: null };
  }

  await insertNotification(supabase, {
    agent_id: client.agent_id,
    kind: "inquiry_received",
    title: created ? `New lead: ${client.name}` : `${client.name} inquired again`,
    body: inquiry || `Source: ${sourceLabel(input.source)}.`,
    related_client_id: client.id,
  });

  const noText = (error: string) => ({
    clientId: client!.id, created, duplicate: false,
    firstText: { ok: false as const, activityId: null, error },
  });
  if (input.autoText === false) return noText("Not texted: no SMS consent for this lead");
  if (!client.phone) return noText("Not texted: lead has no phone number");

  const { data: priorText } = await supabase
    .from("activities").select("id")
    .eq("client_id", client.id).eq("type", "text")
    .limit(1).maybeSingle();
  if (priorText) return { clientId: client.id, created, duplicate: false, firstText: null };

  const { data: agent } = await supabase
    .from("agent_profiles").select("full_name")
    .eq("id", client.agent_id).maybeSingle();

  const body = await draftFirstTouchSms({
    agentName: agent?.full_name || "your agent",
    clientFirstName: firstNameOf(client.name),
    source: sourceLabel(input.source),
    leadMessage: input.message ?? null,
    town: client.town,
    propertyAddress: input.propertyAddress ?? null,
  });
  if (!body) return noText("Claude could not draft the first text");

  const firstText = await sendClientSms(supabase, client, body, {
    metadata: { kind: "first_touch" },
  });
  if (firstText.ok) {
    await supabase.from("clients").update({ status: "contacted" }).eq("id", client.id).eq("status", "new");
  }
  return { clientId: client.id, created, duplicate: false, firstText };
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
