/**
 * The few Graph API calls coexistence onboarding needs. Aria never sends
 * messages through the API — onboarding, webhook subscription, the one-time
 * contacts/history sync request, and a health check are all it calls.
 *
 * Docs: developers.facebook.com/documentation/business-messaging/whatsapp/
 *   embedded-signup/onboarding-business-app-users (coexistence) and
 *   embedded-signup/onboarding-customers-as-a-tech-provider.
 */

export const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type WhatsAppEnv = { appId: string; appSecret: string; configId: string };

/** App ID, App Secret and the Embedded Signup configuration ID, or null if WhatsApp isn't set up. */
export function whatsAppEnv(): WhatsAppEnv | null {
  const appId = process.env.WHATSAPP_APP_ID?.trim();
  const appSecret = (process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET)?.trim();
  const configId = process.env.WHATSAPP_CONFIG_ID?.trim();
  if (!appId || !appSecret || !configId || !process.env.WHATSAPP_TOKEN_KEY || !process.env.WHATSAPP_VERIFY_TOKEN) return null;
  return { appId, appSecret, configId };
}

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly code: number | null) {
    super(message);
  }
}

async function graph<T>(path: string, init: RequestInit & { token?: string; query?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || json.error) {
    // Never include the URL: it can carry the app secret or a code.
    throw new GraphError(json.error?.message ?? `Graph API ${res.status}`, res.status, json.error?.code ?? null);
  }
  return json;
}

/** Embedded Signup code (30-second lifetime) → business integration system user token. */
export async function exchangeCode(env: WhatsAppEnv, code: string): Promise<string> {
  const json = await graph<{ access_token?: string }>("oauth/access_token", {
    query: { client_id: env.appId, client_secret: env.appSecret, code },
  });
  if (!json.access_token) throw new GraphError("No access token in the code exchange response", 502, null);
  return json.access_token;
}

/** The WABA the token was granted for, when the signup event didn't say (newest grant first). */
export async function wabaIdFromToken(env: WhatsAppEnv, token: string): Promise<string | null> {
  const json = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>("debug_token", {
    query: { input_token: token, access_token: `${env.appId}|${env.appSecret}` },
  });
  const scope = json.data?.granular_scopes?.find((s) => s.scope === "whatsapp_business_management");
  return scope?.target_ids?.[0] ?? null;
}

export type PhoneNumberInfo = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  is_on_biz_app?: boolean;
  platform_type?: string;
};

const PHONE_FIELDS = "id,display_phone_number,verified_name,is_on_biz_app,platform_type";

/** The WABA's numbers; coexistence numbers report is_on_biz_app. */
export async function listPhoneNumbers(token: string, wabaId: string): Promise<PhoneNumberInfo[]> {
  const json = await graph<{ data?: PhoneNumberInfo[] }>(`${wabaId}/phone_numbers`, { token, query: { fields: PHONE_FIELDS } });
  return json.data ?? [];
}

/** Health check: "If is_on_biz_app is true and platform_type is CLOUD_API" the number is in coexistence. */
export async function getPhoneNumber(token: string, phoneNumberId: string): Promise<PhoneNumberInfo> {
  return graph<PhoneNumberInfo>(phoneNumberId, { token, query: { fields: PHONE_FIELDS } });
}

/** Sends the WABA's webhooks (messages, echoes, history…) to this app's callback URL. */
export async function subscribeApp(token: string, wabaId: string): Promise<void> {
  await graph(`${wabaId}/subscribed_apps`, { method: "POST", token });
}

/** Stops this app's webhooks for the WABA (disconnect). Best-effort. */
export async function unsubscribeApp(token: string, wabaId: string): Promise<void> {
  await graph(`${wabaId}/subscribed_apps`, { method: "DELETE", token });
}

/**
 * One-time sync request, allowed once per onboarding and only within 24 hours
 * of it: "smb_app_state_sync" (contacts — Aria discards those webhooks) then
 * "history" (up to 6 months of 1:1 chats, if she agrees in her app).
 */
export async function requestSync(token: string, phoneNumberId: string, syncType: "smb_app_state_sync" | "history"): Promise<string | null> {
  const json = await graph<{ request_id?: string }>(`${phoneNumberId}/smb_app_data`, {
    method: "POST",
    token,
    body: JSON.stringify({ messaging_product: "whatsapp", sync_type: syncType }),
  });
  return json.request_id ?? null;
}
