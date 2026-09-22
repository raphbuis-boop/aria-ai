import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
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
    .select("access_token, refresh_token, token_expiry, scope")
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
  return { auth, scopes };
}

/**
 * Returns an authenticated Gmail API client for the given agent.
 * Returns null if the agent has not connected Gmail.
 */
export async function getGmailClient(agentId: string) {
  const google_ = await getGoogleAuth(agentId);
  return google_ ? google.gmail({ version: "v1", auth: google_.auth }) : null;
}

export { makeOAuth2Client };
