import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/account/email { email }
 * Starts an email change. Supabase emails a confirmation link (to both the
 * old and new address when "secure email change" is on); nothing changes
 * until it's clicked.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (email === user.email?.toLowerCase()) return NextResponse.json({ error: "That's already your email." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${origin}/settings` });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: taken ? "That email is already used by another account." : error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: email });
}
