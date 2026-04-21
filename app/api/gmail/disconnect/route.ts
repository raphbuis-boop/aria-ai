import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeRefreshToken } from "@/lib/gmail/vault";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("gmail_connections")
    .select("id, vault_secret_id, encrypted_token")
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ success: true, disconnected: false });

  await purgeRefreshToken(admin, {
    vault_secret_id: (row.vault_secret_id as string | null) ?? null,
    encrypted_token: (row.encrypted_token as string | null) ?? null,
  });

  const { error } = await admin
    .from("gmail_connections")
    .delete()
    .eq("id", row.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, disconnected: true });
}
