import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "offer_made",
  "offer_accepted",
  "under_contract",
  "closed",
  "fell_through",
  "cancelled",
] as const;
type Status = (typeof STATUS_VALUES)[number];

const FELL_THROUGH_REASONS = [
  "financing",
  "inspection",
  "cold_feet",
  "appraisal",
  "title",
  "other",
] as const;
type FellThroughReason = (typeof FELL_THROUGH_REASONS)[number];

type DealInsert = {
  agent_id: string;
  client_id: string;
  transaction_id?: string | null;
  property_address: string;
  status: Status;
  offer_amount?: number | null;
  offer_date?: string | null;
  accepted_date?: string | null;
  closed_date?: string | null;
  outcome?: string | null;
  outcome_notes?: string | null;
  fell_through_reason?: FellThroughReason | null;
};

function sanitizeStatus(raw: unknown): Status {
  const s = String(raw ?? "").trim();
  return (STATUS_VALUES as readonly string[]).includes(s)
    ? (s as Status)
    : "offer_made";
}

function sanitizeReason(raw: unknown): FellThroughReason | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return (FELL_THROUGH_REASONS as readonly string[]).includes(s)
    ? (s as FellThroughReason)
    : null;
}

function sanitizeDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

function sanitizeAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/client-deals?clientId=X
 * Lists the authed agent's deal history for a client, newest first. Also
 * merges any linked rows from the `transactions` table the agent owns for
 * the same client so older contracts that pre-date this feature still surface.
 */
export async function GET(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const { data: deals, error } = await supabase
    .from("client_deals")
    .select("*")
    .eq("agent_id", user.id)
    .eq("client_id", clientId)
    .order("offer_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Pull the agent's transactions for this client too, so the deal history
  // includes current contracts even if the agent hasn't manually logged them.
  const { data: txs } = await supabase
    .from("transactions")
    .select(
      "id, address, contract_price, closing_date, inspection_date, created_at",
    )
    .eq("agent_id", user.id)
    .eq("client_id", clientId);

  const linkedTxIds = new Set(
    (deals ?? [])
      .map((d) => (d as Record<string, unknown>).transaction_id)
      .filter(Boolean),
  );

  const txShadows = (txs ?? [])
    .filter((t) => !linkedTxIds.has((t as Record<string, unknown>).id))
    .map((tRaw) => {
      const t = tRaw as Record<string, unknown>;
      return {
        id: `tx-${String(t.id)}`,
        source: "transaction" as const,
        transaction_id: String(t.id),
        property_address: String(t.address ?? "—"),
        status: "under_contract" as Status,
        offer_amount: (t.contract_price as number | null) ?? null,
        offer_date: null,
        accepted_date: null,
        closed_date: (t.closing_date as string | null) ?? null,
        outcome: null,
        outcome_notes: "Auto-linked from transactions — log deal to enrich.",
        fell_through_reason: null,
        created_at: String(t.created_at ?? new Date().toISOString()),
        updated_at: String(t.created_at ?? new Date().toISOString()),
      };
    });

  const normalized = (deals ?? []).map((dRaw) => {
    const d = dRaw as Record<string, unknown>;
    return { ...d, source: "deal" as const };
  });

  return NextResponse.json({ deals: [...normalized, ...txShadows] });
}

/**
 * POST /api/client-deals
 * Creates a new deal entry for a client owned by the authed agent.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.client_id ?? "").trim();
  const propertyAddress = String(body.property_address ?? "").trim();

  if (!clientId || !propertyAddress) {
    return NextResponse.json(
      { error: "client_id and property_address required" },
      { status: 400 },
    );
  }

  // Ownership check via RLS-aware select — `.maybeSingle()` returns null if
  // the client belongs to another agent.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const status = sanitizeStatus(body.status);

  const insert: DealInsert = {
    agent_id: user.id,
    client_id: clientId,
    transaction_id: body.transaction_id ? String(body.transaction_id) : null,
    property_address: propertyAddress,
    status,
    offer_amount: sanitizeAmount(body.offer_amount),
    offer_date: sanitizeDate(body.offer_date),
    accepted_date: sanitizeDate(body.accepted_date),
    closed_date: sanitizeDate(body.closed_date),
    outcome: body.outcome ? String(body.outcome).trim() : null,
    outcome_notes: body.outcome_notes ? String(body.outcome_notes).trim() : null,
    fell_through_reason:
      status === "fell_through" ? sanitizeReason(body.fell_through_reason) : null,
  };

  const { data, error } = await supabase
    .from("client_deals")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.from("activities").insert({
    client_id: clientId,
    agent_id: user.id,
    type: "note",
    body: `Deal logged: ${propertyAddress} (${status.replace(/_/g, " ")}).`,
    ai_draft: false,
    approved: true,
    sent: false,
  });

  return NextResponse.json({ deal: { ...data, source: "deal" } });
}
