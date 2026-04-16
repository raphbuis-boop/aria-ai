import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const WAITLIST_CAP = 50;

export async function GET() {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          error: "Waitlist is not configured.",
          count: 0,
          spotsRemaining: WAITLIST_CAP,
          cap: WAITLIST_CAP,
        },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const { count, error } = await admin
      .from("waitlist")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, count: 0, spotsRemaining: WAITLIST_CAP, cap: WAITLIST_CAP },
        { status: 500 },
      );
    }

    const c = count ?? 0;
    return NextResponse.json({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      count: c,
      spotsRemaining: Math.max(0, WAITLIST_CAP - c),
      cap: WAITLIST_CAP,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load stats", count: 0, spotsRemaining: WAITLIST_CAP, cap: WAITLIST_CAP },
      { status: 500 },
    );
  }
}
