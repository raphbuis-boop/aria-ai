import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  buildAuthUrl,
  GmailConfigError,
} from "@/lib/gmail/client";
import { signState } from "@/lib/gmail/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = buildAuthUrl(signState(user.id));
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof GmailConfigError) {
      return NextResponse.json(
        { error: "gmail_not_configured", message: err.message },
        { status: 501 },
      );
    }
    throw err;
  }
}
