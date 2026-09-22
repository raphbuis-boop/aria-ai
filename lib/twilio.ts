import twilio from "twilio";

export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function usableNumber(value?: string | null) {
  if (!value || value.startsWith("REPLACE_")) return undefined;
  return value;
}

/** Env-level sending number. `TWILIO_PHONE_NUMBER` is accepted as an alias
 * because that's the name the production env already uses. */
export function defaultFromNumber(): string | undefined {
  return (
    usableNumber(process.env.TWILIO_FROM_NUMBER) ??
    usableNumber(process.env.TWILIO_PHONE_NUMBER)
  );
}

export function parseTwilioForm(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody).entries()) {
    params[key] = value;
  }
  return params;
}

function twilioRequestUrl(request: Request): string {
  const current = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    current.protocol.replace(":", "");
  if (host) {
    current.host = host;
    current.protocol = `${proto}:`;
  }
  return current.toString();
}

/** Verifies the `X-Twilio-Signature` header against auth token (and, if
 * set, a separate webhook secret used only for signing). */
export function verifyTwilioSignature(
  request: Request,
  params: Record<string, string>,
): boolean {
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET;
  const tokens = [authToken, webhookSecret].filter(
    (t): t is string => Boolean(t),
  );
  if (tokens.length === 0) return false;

  const url = twilioRequestUrl(request);
  return tokens.some((token) =>
    twilio.validateRequest(token, signature, url, params),
  );
}

export async function sendSms(input: {
  to: string;
  body: string;
  from?: string | null;
}): Promise<{ sid: string }> {
  // Local/end-to-end testing without a provisioned Twilio number. Never set
  // this in production — nothing reaches the phone.
  if (process.env.SMS_DRY_RUN === "1") {
    console.info("[sms:dry-run]", input.to, JSON.stringify(input.body));
    return { sid: `DRYRUN${crypto.randomUUID().replace(/-/g, "")}` };
  }

  const twilioClient = client();
  if (!twilioClient) {
    throw new Error("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  }

  const messagingServiceSid = usableNumber(
    process.env.TWILIO_MESSAGING_SERVICE_SID,
  );
  const from = usableNumber(input.from) ?? defaultFromNumber();

  if (!messagingServiceSid && !from) {
    throw new Error(
      "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER/TWILIO_PHONE_NUMBER (or agent_profiles.twilio_from_number)",
    );
  }

  // Delivery receipts → /api/webhooks/twilio/status. Twilio needs a public
  // https URL, so this is skipped in local dev.
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const statusCallback = site.startsWith("https://")
    ? `${site.replace(/\/$/, "")}/api/webhooks/twilio/status`
    : undefined;

  return twilioClient.messages.create({
    to: input.to,
    body: input.body,
    ...(statusCallback ? { statusCallback } : {}),
    ...(messagingServiceSid ? { messagingServiceSid } : { from }),
  });
}
