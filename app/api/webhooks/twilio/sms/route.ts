import { waitUntil } from "@vercel/functions";
import { EMPTY_TWIML, parseTwilioForm, verifyTwilioSignature } from "@/lib/twilio";
import { recordInboundSms, respondToInboundSms } from "@/lib/sms/inbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Twilio inbound SMS webhook. Logs the text synchronously, answers Twilio
 * with empty TwiML right away (Aria replies via the REST API, not TwiML),
 * and runs the Claude conversation after the response.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = parseTwilioForm(rawBody);

  if (!verifyTwilioSignature(request, params)) {
    return new Response("Unauthorized", { status: 403 });
  }

  try {
    const work = await recordInboundSms(params);
    if (work) {
      waitUntil(
        respondToInboundSms(work).catch((error) =>
          console.error("Inbound SMS reply failed", error),
        ),
      );
    }
  } catch (error) {
    console.error("Inbound SMS webhook failed", error);
  }

  return new Response(EMPTY_TWIML, {
    headers: { "Content-Type": "text/xml" },
  });
}
