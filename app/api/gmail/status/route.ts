import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmailConnectionInfo } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const info = await getGmailConnectionInfo(user.id);
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
  return NextResponse.json({ ...info, configured });
}
