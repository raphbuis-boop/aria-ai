import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeOAuth2Client } from "@/lib/gmail";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // agent's user.id

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=error`,
    );
  }

  // Verify state is a real user (UUID format check + DB lookup)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(state)) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=error`,
    );
  }

  const supabase = createAdminClient();
  const { data: userRecord } = await supabase.auth.admin.getUserById(state);
  if (!userRecord?.user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=error`,
    );
  }

  try {
    const auth = makeOAuth2Client();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    // Get the Gmail address for this account
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress ?? "";

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=error`,
      );
    }

    await supabase.from("gmail_integrations").upsert(
      {
        agent_id: state,
        email,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token!,
        token_expiry: new Date(tokens.expiry_date ?? Date.now() + 3600_000).toISOString(),
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" },
    );

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=connected`,
    );
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?gmail=error`,
    );
  }
}
