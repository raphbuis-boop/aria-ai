import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

/** Local end-to-end testing only: points every Google API call (OAuth token
 * exchange, Gmail) at a stand-in server. Never set in production. */
const TEST_API_BASE = process.env.GOOGLE_API_BASE_URL?.replace(/\/$/, "") || null;

function makeOAuth2Client() {
  return new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    ...(TEST_API_BASE ? { endpoints: { oauth2TokenUrl: `${TEST_API_BASE}/token` } } : {}),
  });
}

/** Gmail API client for an authorized OAuth client. */
export function gmailFor(auth: InstanceType<typeof google.auth.OAuth2>) {
  return google.gmail({ version: "v1", auth, ...(TEST_API_BASE ? { rootUrl: `${TEST_API_BASE}/` } : {}) });
}

/**
 * Returns an authorized Google OAuth client for the agent (shared by Gmail
 * and Calendar), plus the scopes they granted. Auto-refreshes the access
 * token if expired and persists the new token. Null if not connected.
 */
export async function getGoogleAuth(agentId: string) {
  const supabase = createAdminClient();

  const { data: integration, error } = await supabase
    .from("gmail_integrations")
    .select("email, access_token, refresh_token, token_expiry, scope")
    .eq("agent_id", agentId)
    .single();

  if (error || !integration) return null;

  const auth = makeOAuth2Client();
  auth.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: new Date(integration.token_expiry).getTime(),
  });

  // Auto-refresh if expired (or within 60s of expiry)
  const expiryMs = new Date(integration.token_expiry).getTime();
  if (Date.now() >= expiryMs - 60_000) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      auth.setCredentials(credentials);

      if (credentials.access_token) {
        await supabase
          .from("gmail_integrations")
          .update({
            access_token: credentials.access_token,
            token_expiry: new Date(credentials.expiry_date ?? Date.now() + 3600_000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("agent_id", agentId);
      }
    } catch (err) {
      // Log the reason only — the raw Gaxios error embeds the refresh token
      // in its request config, so it must never be logged whole.
      const reason =
        (err as { response?: { data?: { error_description?: string; error?: string } } })?.response?.data?.error_description ??
        (err instanceof Error ? err.message : "unknown error");
      console.error("[gmail] token refresh failed for agent", agentId, reason);
      return null;
    }
  }

  const scopes = String(integration.scope ?? "").split(/\s+/).filter(Boolean);
  return { auth, scopes, email: String(integration.email ?? "") };
}

/**
 * Returns an authenticated Gmail API client for the given agent.
 * Returns null if the agent has not connected Gmail.
 */
export async function getGmailClient(agentId: string) {
  const google_ = await getGoogleAuth(agentId);
  return google_ ? gmailFor(google_.auth) : null;
}

/** Gmail client plus the connected address (to tell the agent's own mail apart). */
export async function getGmail(agentId: string) {
  const google_ = await getGoogleAuth(agentId);
  return google_ ? { gmail: gmailFor(google_.auth), email: google_.email.toLowerCase() } : null;
}

/** httpOnly cookie carrying the OAuth `state` nonce between connect and callback. */
export const GOOGLE_OAUTH_COOKIE = "aria_google_oauth";

export { makeOAuth2Client };
