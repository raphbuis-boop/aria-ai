import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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
    });
    if (error) {
      console.error("[listing-inquiries]", error);
      return NextResponse.json(
        { error: "Could not save your request. Please try again later." },
        { status: 500 },
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
