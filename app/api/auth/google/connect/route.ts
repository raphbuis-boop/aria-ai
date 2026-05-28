import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { makeOAuth2Client } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = makeOAuth2Client();

  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: user.id,
  });

  return NextResponse.redirect(url);
}
