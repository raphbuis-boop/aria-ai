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

type DealUpdate = Partial<{
  property_address: string;
  status: Status;
  offer_amount: number | null;
  offer_date: string | null;
  accepted_date: string | null;
  closed_date: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  fell_through_reason: FellThroughReason | null;
  transaction_id: string | null;
}>;

/**
 * PATCH /api/client-deals/[id]
 * Partial update. Only fields that are explicitly provided are changed,
 * which lets the UI "mark as closed" without also clearing other fields.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: DealUpdate = {};

  if (typeof body.property_address === "string") {
    const v = body.property_address.trim();
    if (v) update.property_address = v;
  }
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if ((STATUS_VALUES as readonly string[]).includes(s)) {
      update.status = s as Status;
    }
  }
  if (body.offer_amount !== undefined) {
    const n = body.offer_amount == null || body.offer_amount === ""
      ? null
      : Number(body.offer_amount);
    update.offer_amount = Number.isFinite(n as number) ? (n as number) : null;
  }
  for (const k of ["offer_date", "accepted_date", "closed_date"] as const) {
    if (body[k] !== undefined) {
      update[k] = body[k] ? String(body[k]) : null;
    }
  }
  if (body.outcome !== undefined) {
    update.outcome = body.outcome ? String(body.outcome).trim() : null;
  }
  if (body.outcome_notes !== undefined) {
    update.outcome_notes = body.outcome_notes
      ? String(body.outcome_notes).trim()
      : null;
  }
  if (body.fell_through_reason !== undefined) {
    const r = String(body.fell_through_reason ?? "").trim();
    update.fell_through_reason = (FELL_THROUGH_REASONS as readonly string[]).includes(r)
      ? (r as FellThroughReason)
      : null;
  }
  if (body.transaction_id !== undefined) {
    update.transaction_id = body.transaction_id
      ? String(body.transaction_id)
      : null;
  }

  // If caller flipped status to something other than fell_through, clear the
  // reason so we don't leave stale data.
  if (update.status && update.status !== "fell_through") {
    update.fell_through_reason = null;
  }

  const { data, error } = await supabase
    .from("client_deals")
    .update(update)
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deal: { ...data, source: "deal" } });
}

/**
 * DELETE /api/client-deals/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("client_deals")
    .delete()
    .eq("id", params.id)
    .eq("agent_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
