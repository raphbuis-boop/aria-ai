import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { extractProperty } from "@/lib/property-extract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/properties/extract { input } — a Zillow / Realtor.com / NJMLS link
 * or a bare MLS #. Returns suggested property fields for the agent to confirm;
 * nothing is saved here.
 */
export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { input?: unknown };
  const input = typeof body.input === "string" ? body.input.slice(0, 2000) : "";
  const result = await extractProperty(input);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
