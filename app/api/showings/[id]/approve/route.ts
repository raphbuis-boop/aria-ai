import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveShowingRequest } from "@/lib/sms/showings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/showings/[id]/approve  { showingDate?: ISO string }
 * Agent approves a client's SMS showing request: schedules it, texts the
 * confirmation, then texts the BBA signing link if the client hasn't signed.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { showingDate?: unknown };
  const showingDate = typeof body.showingDate === "string" ? body.showingDate : null;

  const result = await approveShowingRequest(createAdminClient(), user.id, params.id, showingDate);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
