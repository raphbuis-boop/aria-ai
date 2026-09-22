import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { declineShowingRequest } from "@/lib/sms/showings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/showings/[id]/decline  { message?: string } — optional SMS to the client. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message : null;

  const result = await declineShowingRequest(createAdminClient(), user.id, params.id, message);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
