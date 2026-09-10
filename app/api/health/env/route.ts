import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { isSimplyRetsConfigured } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";

/**
 * Reports which server-side integrations are configured, as booleans only —
 * never leaks secrets. Used by the settings page to warn the agent when a
 * critical integration (e.g. the AI key) is missing instead of silently
 * degrading to generic templates.
 */
export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    mlsConfigured: isSimplyRetsConfigured(),
  });
}
