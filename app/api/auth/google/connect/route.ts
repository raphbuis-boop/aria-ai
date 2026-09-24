import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { makeOAuth2Client, GOOGLE_OAUTH_COOKIE } from "@/lib/gmail";
import { randomBytes } from "node:crypto";

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
  // `state` is a one-time nonce, not the user id: the callback only accepts
  // it from the same browser (httpOnly cookie) and the same signed-in user,
  // so nobody can attach their Google account to someone else's Aria.
  const nonce = randomBytes(24).toString("base64url");

  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: nonce,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_COOKIE, `${nonce}.${user.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
