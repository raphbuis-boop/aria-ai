import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/password { current?, next }
 * Accounts that have a password must prove it before changing it (a stolen
 * session alone can't lock the owner out). Google/Apple-only accounts can
 * set a first password without one.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
  const next = typeof body.next === "string" ? body.next : "";
  const current = typeof body.current === "string" ? body.current : "";
  if (next.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  if (next.length > 72) return NextResponse.json({ error: "Use 72 characters or fewer." }, { status: 400 });

  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");
  if (hasPassword) {
    if (!current) return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
    if (current === next) return NextResponse.json({ error: "That's your current password — pick a new one." }, { status: 400 });
    // Stateless check: doesn't touch the browser's session cookies.
    const probe = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: badCurrent } = await probe.auth.signInWithPassword({ email: user.email, password: current });
    if (badCurrent) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    // scope "local" ends only this probe session — the default ("global") would sign the agent out everywhere.
    await probe.auth.signOut({ scope: "local" }).catch(() => {});
  }

  // Through the agent's own session so this device stays signed in (an admin
  // update ends every session, including this one). If Supabase wants a
  // fresh re-authentication, the current password was just verified above,
  // so fall back to the admin update and ask them to sign in again.
  const { error } = await supabase.auth.updateUser({ password: next });
  if (!error) return NextResponse.json({ ok: true, hadPassword: hasPassword, signedOut: false });

  if (/reauth|nonce/i.test(error.message)) {
    const { error: adminError } = await createAdminClient().auth.admin.updateUserById(user.id, { password: next });
    if (!adminError) return NextResponse.json({ ok: true, hadPassword: hasPassword, signedOut: true });
  }
  console.error("[account/password] update failed", user.id, error.message);
  const weak = /weak|pwned|leaked|characters/i.test(error.message);
  return NextResponse.json({ error: weak ? error.message : "Couldn't update your password. Try again." }, { status: weak ? 400 : 500 });
}
