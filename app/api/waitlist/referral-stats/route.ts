import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CODE_RE = /^[a-z0-9]{6}$/;

export async function GET(req: Request) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const raw = String(searchParams.get("code") ?? "").trim().toLowerCase();
    if (!CODE_RE.test(raw)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("waitlist")
      .select("referral_count")
      .eq("referral_code", raw)
      .maybeSingle();

    if (error) {
      console.error("[waitlist/referral-stats]", error.message);
      return NextResponse.json({ error: "Could not load stats." }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ referral_count: 0 });
    }

    return NextResponse.json({ referral_count: data.referral_count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Failed to load referral stats" }, { status: 500 });
  }
}
