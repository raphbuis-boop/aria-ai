import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeAgentFiles } from "@/lib/account-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DELETE /api/account  { confirm: "DELETE" }
 * Permanently deletes the signed-in agent. Every agent-owned table cascades
 * from auth.users except IDX listing inquiries, which are cleared first.
 * Storage doesn't cascade, so uploaded documents and signed BBA PDFs are
 * removed before the user is.
 */
export async function DELETE(request: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: inquiriesError } = await admin.from("idx_listing_inquiries").delete().eq("agent_id", user.id);
  if (inquiriesError) {
    console.error("[account] clearing inquiries failed", inquiriesError.message);
    return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });
  }

  // Files first: their paths live in rows the user deletion cascades away.
  await removeAgentFiles(admin, user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] deleteUser failed", error.message);
    return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
