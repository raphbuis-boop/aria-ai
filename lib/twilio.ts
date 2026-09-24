import twilio from "twilio";
import { TWILIO_ERROR_HINTS, twilioErrorHint } from "@/lib/twilio-errors";

export { twilioErrorHint };

export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

/** Env values pasted into a dashboard often carry a trailing newline or
 * space, which silently breaks Twilio auth (20003) or the From match. */
function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function client() {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function usableNumber(value?: string | null) {
  const v = value?.trim();
  if (!v || v.startsWith("REPLACE_")) return undefined;
  return v;
}

export type TwilioErrorInfo = { code: number | null; status: number | null; message: string; hint: string | null };

export function twilioErrorInfo(error: unknown): TwilioErrorInfo {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === "number" ? e.code : Number(e.code) || null;
  return {
    code,
    status: typeof e.status === "number" ? e.status : null,
    message: typeof e.message === "string" ? e.message : String(error),
    hint: code ? TWILIO_ERROR_HINTS[code] ?? null : null,
  };
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

  const authToken = env("TWILIO_AUTH_TOKEN");
  const webhookSecret = env("TWILIO_WEBHOOK_SECRET");
  if (!authToken && !webhookSecret) return false;

  const url = twilioRequestUrl(request);
  if (authToken && twilio.validateRequest(authToken, signature, url, params)) return true;
  if (webhookSecret && twilio.validateRequest(webhookSecret, signature, url, params)) {
    // Outbound sends authenticate with TWILIO_AUTH_TOKEN only. If inbound
    // only passes on the webhook secret, the auth token is not this
    // number's account token and every send will fail with 20003.
    if (authToken) {
      console.warn(
        "[twilio] inbound signature matched TWILIO_WEBHOOK_SECRET but not TWILIO_AUTH_TOKEN — the auth token does not belong to the account that owns this number",
      );
    }
    return true;
  }
  return false;
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

  const messagingServiceSid = usableNumber(env("TWILIO_MESSAGING_SERVICE_SID"));
  const from = usableNumber(input.from) ?? defaultFromNumber();

  if (!messagingServiceSid && !from) {
    throw new Error(
      "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER/TWILIO_PHONE_NUMBER (or agent_profiles.twilio_from_number)",
    );
  }

  // Delivery receipts → /api/webhooks/twilio/status. Twilio needs a public
  // https URL, so this is skipped in local dev.
  const site = env("NEXT_PUBLIC_SITE_URL") ?? "";
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

export type TwilioCheck = { name: string; ok: boolean; detail: string };

/**
 * Live check that the configured SID, auth token, sending number and
 * (optional) messaging service all belong to one working Twilio account.
 * Read-only — sends nothing.
 */
export async function checkTwilioSetup(fromOverride?: string | null): Promise<TwilioCheck[]> {
  const checks: TwilioCheck[] = [];
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const rawSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const rawToken = process.env.TWILIO_AUTH_TOKEN ?? "";

  checks.push({
    name: "Account SID format",
    ok: Boolean(sid && /^AC[0-9a-f]{32}$/i.test(sid)),
    detail: !sid
      ? "TWILIO_ACCOUNT_SID is not set"
      : /^AC[0-9a-f]{32}$/i.test(sid)
        ? `${sid.slice(0, 6)}…${sid.slice(-4)}${rawSid !== sid ? " (had surrounding whitespace — trimmed)" : ""}`
        : `Doesn't look like an Account SID (should be AC + 32 hex chars; got ${sid.length} chars starting "${sid.slice(0, 2)}")`,
  });
  checks.push({
    name: "Auth token format",
    ok: Boolean(token && /^[0-9a-f]{32}$/i.test(token)),
    detail: !token
      ? "TWILIO_AUTH_TOKEN is not set"
      : /^[0-9a-f]{32}$/i.test(token)
        ? `32 chars${rawToken !== token ? " (had surrounding whitespace — trimmed)" : ""}`
        : `Expected 32 hex chars, got ${token.length}${token.startsWith("SK") ? " — this looks like an API Key SID, not the account auth token" : ""}`,
  });

  const c = client();
  if (!c || !sid) return checks;

  let account: { status: string; type: string; friendlyName: string } | null = null;
  try {
    account = await c.api.v2010.accounts(sid).fetch();
    checks.push({
      name: "SID + auth token authenticate",
      ok: account.status === "active",
      detail: `${account.friendlyName} · status ${account.status}`,
    });
    checks.push({
      name: "Account type",
      ok: account.type !== "Trial",
      detail:
        account.type === "Trial"
          ? "Trial account — it can only text verified numbers and prefixes every message. Upgrade in the Twilio console."
          : account.type,
    });
  } catch (error) {
    const info = twilioErrorInfo(error);
    checks.push({
      name: "SID + auth token authenticate",
      ok: false,
      detail: `Twilio ${info.code ?? info.status ?? ""}: ${info.hint ?? info.message}`,
    });
    return checks;
  }

  const serviceSid = usableNumber(env("TWILIO_MESSAGING_SERVICE_SID"));
  const from = usableNumber(fromOverride) ?? defaultFromNumber();

  if (serviceSid) {
    try {
      const service = await c.messaging.v1.services(serviceSid).fetch();
      const senders = await c.messaging.v1.services(serviceSid).phoneNumbers.list({ limit: 20 });
      checks.push({
        name: "Messaging Service",
        ok: senders.length > 0,
        detail: `${service.friendlyName} · ${senders.length} sender number(s): ${senders.map((p) => p.phoneNumber).join(", ") || "none"}. Sends use this service, not TWILIO_FROM_NUMBER.`,
      });
    } catch (error) {
      const info = twilioErrorInfo(error);
      checks.push({
        name: "Messaging Service",
        ok: false,
        detail: `TWILIO_MESSAGING_SERVICE_SID ${serviceSid} isn't usable on this account — Twilio ${info.code ?? ""}: ${info.hint ?? info.message}`,
      });
    }
  }

  if (from) {
    try {
      const owned = await c.api.v2010.accounts(sid).incomingPhoneNumbers.list({ phoneNumber: from, limit: 1 });
      const n = owned[0];
      checks.push({
        name: "Sending number owned by this account",
        ok: Boolean(n?.capabilities?.sms),
        detail: !n
          ? `${from} is not a number on this Twilio account${serviceSid ? " (unused while a Messaging Service is set)" : ""}`
          : n.capabilities?.sms
            ? `${from} · SMS capable`
            : `${from} is on this account but not SMS-capable`,
      });
    } catch (error) {
      const info = twilioErrorInfo(error);
      checks.push({ name: "Sending number owned by this account", ok: false, detail: `Twilio ${info.code ?? ""}: ${info.message}` });
    }
  } else if (!serviceSid) {
    checks.push({ name: "Sending number", ok: false, detail: "Set TWILIO_FROM_NUMBER (or TWILIO_MESSAGING_SERVICE_SID)" });
  }

  // Why the most recent sends failed, straight from Twilio.
  try {
    const recent = await c.api.v2010.accounts(sid).messages.list({ limit: 10 });
    const failed = recent.filter((m) => m.direction !== "inbound" && (m.errorCode || m.status === "failed" || m.status === "undelivered"));
    if (failed.length) {
      const m = failed[0];
      checks.push({
        name: "Latest failed message on Twilio",
        ok: false,
        detail: `${m.status} · error ${m.errorCode ?? "—"}${twilioErrorHint(m.errorCode) ? ` — ${twilioErrorHint(m.errorCode)}` : ""} (to …${m.to.slice(-4)}, ${m.dateCreated?.toISOString?.() ?? ""})`,
      });
    }
  } catch {
    /* listing is best-effort */
  }

  return checks;
}
