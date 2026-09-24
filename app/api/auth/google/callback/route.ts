import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeOAuth2Client, gmailFor, GOOGLE_OAUTH_COOKIE } from "@/lib/gmail";
import { getRouteSupabase } from "@/lib/api-auth";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/** Where the agent started the Google connect flow. */
function returnPath(returnTo: string | undefined): string {
  if (returnTo === "onboarding") return "/onboarding";
  if (returnTo === "inbox") return "/emails";
  return "/settings";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // one-time nonce from /connect

  // Read return destination cookie early so all error paths can use it
  const cookieStore = cookies();
  const returnTo = cookieStore.get("aria_return_to")?.value;
  const base = process.env.NEXT_PUBLIC_SITE_URL;

  function errorRedirect() {
    const dest = `${base}${returnPath(returnTo)}?gmail=error`;
    const res = NextResponse.redirect(dest);
    res.cookies.set("aria_return_to", "", { path: "/", maxAge: 0 });
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  }

  if (!code || !state) return errorRedirect();

  // The Google account is attached to whoever is signed in *now*, and only if
  // this browser started the flow (nonce cookie) as that same user.
  const { user } = await getRouteSupabase();
  const [nonce, cookieUserId] = (cookieStore.get(GOOGLE_OAUTH_COOKIE)?.value ?? "").split(".");
  const nonceOk =
    Boolean(nonce) &&
    nonce.length === state.length &&
    timingSafeEqual(Buffer.from(nonce), Buffer.from(state));
  if (!user || !nonceOk || cookieUserId !== user.id) {
    console.warn("[google/callback] rejected: state/session mismatch");
    return errorRedirect();
  }
  const agentId = user.id;

  const supabase = createAdminClient();

  try {
    const auth = makeOAuth2Client();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    // Get the Gmail address for this account
    const gmail = gmailFor(auth);
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress ?? "";

    if (!email) return errorRedirect();

    // Google omits refresh_token on some re-consents; keep the stored one.
    let refreshToken = tokens.refresh_token ?? null;
    if (!refreshToken) {
      const { data: existing } = await supabase
        .from("gmail_integrations")
        .select("refresh_token")
        .eq("agent_id", agentId)
        .maybeSingle();
      refreshToken = (existing?.refresh_token as string | undefined) ?? null;
    }
    if (!tokens.access_token || !refreshToken) {
      console.error("[google/callback] missing tokens from Google");
      return errorRedirect();
    }

    const { error: saveError } = await supabase.from("gmail_integrations").upsert(
      {
        agent_id: agentId,
        email,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expiry: new Date(tokens.expiry_date ?? Date.now() + 3600_000).toISOString(),
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" },
    );
    if (saveError) {
      console.error("[google/callback] saving tokens failed", saveError.message);
      return errorRedirect();
    }

    const destination = `${base}${returnPath(returnTo)}?gmail=connected`;

    const res = NextResponse.redirect(destination);
    res.cookies.set("aria_return_to", "", { path: "/", maxAge: 0 });
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch {
    return errorRedirect();
  }
}
