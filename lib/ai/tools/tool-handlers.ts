import type { SupabaseClient } from "@supabase/supabase-js";
import twilio from "twilio";
import {
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  mapSimplyRetsListing,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";
import { formatPhoneE164 } from "@/lib/utils";
import { TOOL_NAMES, type ToolName } from "./tool-definitions";

/**
 * Runtime logic for every Aria tool. Each handler talks to a REAL backend
 * (SimplyRETS MLS, Supabase CRM, or Twilio) and returns a structured result.
 *
 * The cardinal rule: a handler returns `success: true` ONLY when the
 * underlying system actually confirmed the operation (HTTP 2xx from the MLS,
 * a row written to Supabase, a queued message from Twilio). The orchestrator
 * feeds this verbatim back to the model so the model can only confirm what
 * truly happened.
 */

export type ToolContext = {
  /** Request-scoped Supabase client (RLS enforces agent ownership). */
  supabase: SupabaseClient;
  /** Authenticated agent's auth.users id. */
  agentId: string;
};

export type ToolResult = Record<string, unknown> & { success: boolean };

// ── search_mls_properties ──────────────────────────────────────────────────

type SearchMlsInput = {
  city?: unknown;
  state?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  minBeds?: unknown;
  minBaths?: unknown;
  limit?: unknown;
};

function numOrUndef(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function searchMlsProperties(
  _ctx: ToolContext,
  input: SearchMlsInput,
): Promise<ToolResult> {
  const city = String(input.city ?? "").trim();
  if (!city) {
    return { success: false, error: "A city/town is required to search the MLS." };
  }

  if (!isSimplyRetsConfigured()) {
    return {
      success: false,
      error: "The MLS (SimplyRETS) integration is not configured on this server.",
    };
  }

  const limit = Math.min(25, Math.max(1, Number(input.limit ?? 10) || 10));
  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ?? SIMPLYRETS_API_BASE;

  const params = new URLSearchParams();
  params.set("status", "Active");
  params.set("limit", String(limit));
  params.set("cities", city);
  const state = String(input.state ?? "").trim();
  if (state) params.set("state", state);
  const minPrice = numOrUndef(input.minPrice);
  const maxPrice = numOrUndef(input.maxPrice);
  const minBeds = numOrUndef(input.minBeds);
  const minBaths = numOrUndef(input.minBaths);
  if (minPrice) params.set("minprice", String(minPrice));
  if (maxPrice) params.set("maxprice", String(maxPrice));
  if (minBeds) params.set("minbeds", String(minBeds));
  if (minBaths) params.set("minbaths", String(minBaths));

  const endpoint = `${base}/properties?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: getSimplyRetsAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `MLS request failed: ${message}` };
  }

  if (!res.ok) {
    return {
      success: false,
      error: `MLS returned HTTP ${res.status}. No listings retrieved.`,
    };
  }

  const data = (await res.json()) as unknown;
  const rawList = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).properties)
      ? ((data as Record<string, unknown>).properties as unknown[])
      : [];

  // Trim each listing to the fields the model needs — keeps token usage low and
  // prevents the model from inventing details it never received.
  const listings = (rawList as Record<string, unknown>[])
    .map((item) => mapSimplyRetsListing(item))
    .filter((l) => {
      const t = (l.propertyType ?? "").toLowerCase();
      return t !== "rental" && !t.includes("rental");
    })
    .map((l) => ({
      mlsNumber: l.mlsNumber,
      address: l.address,
      city: l.city,
      state: l.state ?? null,
      price: l.price,
      beds: l.beds,
      baths: l.baths,
      sqft: l.sqft,
      status: l.status,
      daysOnMarket: l.daysOnMarket,
    }));

  return {
    success: true,
    query: { city, state: state || null, minPrice, maxPrice, minBeds, minBaths, limit },
    count: listings.length,
    listings,
  };
}

// ── get_client_preferences ─────────────────────────────────────────────────

type GetClientInput = {
  client_id?: unknown;
  client_name?: unknown;
};

const CLIENT_PREF_COLUMNS =
  "id, name, phone, email, status, lead_score, town, preferred_towns, " +
  "nearby_towns_ok, budget_min, budget_max, budget_flex_pct, beds_wanted, " +
  "bed_flex, baths_wanted, bath_flex, notes";

export async function getClientPreferences(
  ctx: ToolContext,
  input: GetClientInput,
): Promise<ToolResult> {
  const { supabase, agentId } = ctx;
  const clientId = String(input.client_id ?? "").trim();
  const clientName = String(input.client_name ?? "").trim();

  if (!clientId && !clientName) {
    return {
      success: false,
      error: "Provide a client_id or client_name to look up preferences.",
    };
  }

  let query = supabase
    .from("clients")
    .select(CLIENT_PREF_COLUMNS)
    .eq("agent_id", agentId);

  query = clientId
    ? query.eq("id", clientId)
    : query.ilike("name", `%${clientName}%`);

  const { data, error } = await query.limit(5);

  if (error) {
    return { success: false, error: `Supabase lookup failed: ${error.message}` };
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) {
    return {
      success: false,
      error: clientId
        ? `No client found with id ${clientId} for this agent.`
        : `No client matched "${clientName}".`,
    };
  }

  if (rows.length > 1) {
    // Ambiguous name — return the candidates so the model can disambiguate
    // with the agent rather than guessing.
    return {
      success: false,
      ambiguous: true,
      error: `Multiple clients matched "${clientName}". Ask the agent which one.`,
      candidates: rows.map((r) => ({ id: r.id, name: r.name, town: r.town })),
    };
  }

  return { success: true, client: rows[0] };
}

// ── send_client_message ────────────────────────────────────────────────────

type SendMessageInput = {
  client_id?: unknown;
  client_name?: unknown;
  message?: unknown;
};

export async function sendClientMessage(
  ctx: ToolContext,
  input: SendMessageInput,
): Promise<ToolResult> {
  const { supabase, agentId } = ctx;
  const clientId = String(input.client_id ?? "").trim();
  const clientName = String(input.client_name ?? "").trim();
  const message = String(input.message ?? "").trim();

  if (!message) {
    return { success: false, error: "Message text is empty — nothing to send." };
  }
  if (!clientId && !clientName) {
    return {
      success: false,
      error: "Provide a client_id or client_name to send the message to.",
    };
  }

  // 1) Resolve the recipient from Supabase (and confirm they belong to agent).
  let lookup = supabase
    .from("clients")
    .select("id, name, phone")
    .eq("agent_id", agentId);
  lookup = clientId
    ? lookup.eq("id", clientId)
    : lookup.ilike("name", `%${clientName}%`);

  const { data: clientRows, error: lookupErr } = await lookup.limit(5);
  if (lookupErr) {
    return { success: false, error: `Client lookup failed: ${lookupErr.message}` };
  }
  const rows = (clientRows ?? []) as { id: string; name: string | null; phone: string | null }[];
  if (rows.length === 0) {
    return {
      success: false,
      error: clientId
        ? `No client found with id ${clientId}.`
        : `No client matched "${clientName}".`,
    };
  }
  if (rows.length > 1) {
    return {
      success: false,
      ambiguous: true,
      error: `Multiple clients matched "${clientName}". Ask the agent which one before sending.`,
      candidates: rows.map((r) => ({ id: r.id, name: r.name })),
    };
  }

  const client = rows[0];
  const toE164 = client.phone ? formatPhoneE164(client.phone) : null;
  if (!toE164) {
    return {
      success: false,
      error: `${client.name ?? "That client"} has no valid phone number on file.`,
    };
  }

  // 2) Confirm Twilio is configured.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { success: false, error: "Twilio is not configured on this server." };
  }

  // 3) Send via Twilio — only proceed past this point on a real send.
  let messageSid: string;
  try {
    const twilioClient = twilio(sid, token);
    const sent = await twilioClient.messages.create({
      body: message,
      from,
      to: toE164,
    });
    messageSid = sent.sid;
  } catch (e: unknown) {
    const err = e as { message?: string; code?: number };
    const userMessage =
      err.code === 21608
        ? "Twilio is in trial mode and can only send to verified numbers."
        : err.message ?? "Twilio send failed.";
    return { success: false, error: userMessage, twilioCode: err.code };
  }

  // 4) Persist to the activity thread. Mirrors /api/sms/send semantics:
  // a "sent" activity is only recorded when Twilio accepted the message.
  const { error: dbErr } = await supabase.from("activities").insert({
    client_id: client.id,
    agent_id: agentId,
    type: "text",
    body: message,
    ai_draft: false,
    approved: true,
    sent: true,
    direction: "outbound",
    external_id: messageSid,
  });

  if (dbErr) {
    // The text DID go out — be honest about the partial failure.
    return {
      success: true,
      warning:
        "Message was delivered via Twilio but could not be saved to the CRM thread.",
      messageSid,
      clientId: client.id,
      clientName: client.name,
    };
  }

  return {
    success: true,
    messageSid,
    clientId: client.id,
    clientName: client.name,
    to: toE164,
  };
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const args = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name as ToolName) {
      case TOOL_NAMES.searchMlsProperties:
        return await searchMlsProperties(ctx, args);
      case TOOL_NAMES.getClientPreferences:
        return await getClientPreferences(ctx, args);
      case TOOL_NAMES.sendClientMessage:
        return await sendClientMessage(ctx, args);
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Tool "${name}" threw: ${message}` };
  }
}
