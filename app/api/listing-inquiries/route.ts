/**
 * Public MLS listing inquiries → `idx_listing_inquiries`.
 * POST: public (service-role insert, honeypot-protected).
 * GET:  authenticated agents only — returns inquiries for the dashboard.
 */
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ingestLead } from "@/lib/sms/lead";
import { defaultLeadAgentId } from "@/lib/sms/lead-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 40;
const MAX_MESSAGE = 2000;
const MAX_LISTING_ID = 200;
const MAX_ADDRESS = 500;

function trimStr(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
}

export async function GET(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("idx_listing_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && ["new", "contacted", "converted", "archived"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listing-inquiries GET]", error);
    return NextResponse.json({ error: "Failed to load inquiries." }, { status: 500 });
  }

  return NextResponse.json({ inquiries: data ?? [] });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const honeypot = trimStr(body.website, 80);
  if (honeypot) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const intentRaw = trimStr(body.intent, 20);
  const intent =
    intentRaw === "showing" || intentRaw === "info" ? intentRaw : "info";

  const visitor_name = trimStr(body.name, MAX_NAME);
  const visitor_email = trimStr(body.email, MAX_EMAIL);
  const visitor_phone = trimStr(body.phone, MAX_PHONE);
  const message = trimStr(body.message, MAX_MESSAGE);
  const listing_id = trimStr(body.listing_id, MAX_LISTING_ID);
  const listing_address = trimStr(body.listing_address, MAX_ADDRESS);
  const mls_number = trimStr(body.mls_number, 80);
  const listing_price =
    typeof body.listing_price === "number" && body.listing_price > 0
      ? Math.round(body.listing_price)
      : null;

  if (!visitor_name || visitor_name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!visitor_email || !visitor_email.includes("@")) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!listing_id) {
    return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("idx_listing_inquiries").insert({
      intent,
      visitor_name,
      visitor_email,
      visitor_phone: visitor_phone || null,
      message: message || null,
      listing_id,
      listing_address: listing_address || null,
      mls_number: mls_number || null,
      listing_price,
    });
    if (error) {
      console.error("[listing-inquiries]", error);
      return NextResponse.json(
        { error: "Could not save your request. Please try again later." },
        { status: 500 },
      );
    }

    // Notify all agents about the new inquiry (fire-and-forget)
    try {
      const { data: agentList } = await admin.auth.admin.listUsers({ perPage: 10 });
      for (const agent of agentList?.users ?? []) {
        await insertNotification(admin, {
          agent_id: agent.id,
          kind: "inquiry_received",
          title: `New inquiry: ${visitor_name}`,
          body: listing_address
            ? `${intent === "showing" ? "Showing request" : "Info request"} · ${listing_address}`
            : `${intent === "showing" ? "Showing request" : "Info request"}`,
          related_listing_id: listing_id,
        });
      }
    } catch (e) {
      console.error("[listing-inquiries] notification failed", e);
    }

    // Website lead → client + Aria. Only texts when the visitor ticked the
    // SMS consent box; otherwise the client is created without a text.
    const leadAgentId = defaultLeadAgentId();
    if (leadAgentId) {
      waitUntil(
        ingestLead(admin, {
          agentId: leadAgentId,
          source: "website",
          name: visitor_name,
          phone: visitor_phone || null,
          email: visitor_email,
          message: `${intent === "showing" ? "Wants a showing." : "Wants info."}${message ? ` ${message}` : ""}`,
          propertyAddress: listing_address || null,
          budgetMax: listing_price,
          autoText: body.sms_consent === true,
        }).catch((e) => console.error("[listing-inquiries] lead ingest failed", e)),
      );
    }
  } catch (e) {
    console.error("[listing-inquiries] insert failed", e);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
