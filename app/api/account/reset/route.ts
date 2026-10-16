import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { wipeAgentData } from "@/lib/account-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/account/reset  { confirm: "RESET" }
 * Clears the signed-in agent's own CRM data (clients, activity, tasks,
 * showings, transactions, matches, properties, documents…) back to a blank
 * slate. The account, settings, voice and Google connection stay.
 */
export async function POST(request: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "RESET") {
    return NextResponse.json({ error: "Type RESET to confirm" }, { status: 400 });
  }

  try {
    const result = await wipeAgentData(createAdminClient(), user.id);
    if (result.failed.length) {
      console.error("[account/reset] incomplete", user.id, JSON.stringify(result));
      const what = [...new Set(result.failed.map((f) => f.target))].join(", ");
      return NextResponse.json(
        { error: `Couldn't clear ${what}. Everything else was cleared — try again.`, ...result },
        { status: 500 },
      );
    }
    console.info("[account/reset] cleared", user.id, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[account/reset] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't finish clearing your data. Try again." }, { status: 500 });
  }
}
