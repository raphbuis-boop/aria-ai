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
 * Returns an authenticated Gmail API client for the given agent.
 * Auto-refreshes the access token if expired and persists the new token.
 * Returns null if the agent has not connected Gmail.
 */
export async function getGmailClient(agentId: string) {
  const supabase = createAdminClient();

  const { data: integration, error } = await supabase
    .from("gmail_integrations")
    .select("access_token, refresh_token, token_expiry")
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
    } catch {
      // Refresh failed — return null so caller can prompt re-auth
      return null;
    }
  }

  return google.gmail({ version: "v1", auth });
}

export { makeOAuth2Client };
