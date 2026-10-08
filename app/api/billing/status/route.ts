import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

/** GET /api/billing/status — the signed-in agent's access + plan state (no Stripe ids). */
export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAccess(user));
}
