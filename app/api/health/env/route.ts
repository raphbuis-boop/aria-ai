import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { isSimplyRetsConfigured } from "@/lib/simplyrets";
import { defaultFromNumber } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const set = (v: string | undefined) => Boolean(v?.trim());

/**
 * Reports which server-side integrations are configured — booleans and the
 * (public) sending number only, never secrets. Drives the status rows on
 * the Settings page.
 */
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("twilio_from_number")
    .eq("id", user.id)
    .maybeSingle();
  const fromNumber = (profile?.twilio_from_number as string | null) || defaultFromNumber() || null;

  return NextResponse.json({
    aiConfigured: set(process.env.ANTHROPIC_API_KEY),
    emailConfigured: set(process.env.RESEND_API_KEY),
    mlsConfigured: isSimplyRetsConfigured(),
    sms: {
      configured:
        set(process.env.TWILIO_ACCOUNT_SID) &&
        set(process.env.TWILIO_AUTH_TOKEN) &&
        (Boolean(fromNumber) || set(process.env.TWILIO_MESSAGING_SERVICE_SID)),
      fromNumber,
      messagingService: set(process.env.TWILIO_MESSAGING_SERVICE_SID),
      dryRun: process.env.SMS_DRY_RUN === "1",
    },
    leads: {
      webhookConfigured: set(process.env.LEAD_WEBHOOK_SECRET),
      defaultAgent: process.env.LEAD_DEFAULT_AGENT_ID === user.id,
      metaConfigured: set(process.env.META_APP_SECRET) && set(process.env.META_PAGE_ACCESS_TOKEN),
    },
    calendarWriteEnabled: process.env.GOOGLE_CALENDAR_WRITE === "1",
    googleConfigured: set(process.env.GOOGLE_CLIENT_ID) && set(process.env.GOOGLE_CLIENT_SECRET),
  });
}
