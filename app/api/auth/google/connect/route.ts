import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { makeOAuth2Client } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  // Lets Aria put approved showings on the agent's calendar. Off until the
  // Google OAuth app is verified for this scope.
  ...(process.env.GOOGLE_CALENDAR_WRITE === "1"
    ? ["https://www.googleapis.com/auth/calendar.events"]
    : []),
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
