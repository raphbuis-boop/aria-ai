/**
 * Server-side Gmail client factory.
 *
 * `getGmailClient(agentId)` returns an authenticated `gmail_v1.Gmail`
 * instance + the OAuth2 wrapper so callers can also hit people/profile
 * endpoints if needed.  Access tokens are obtained fresh from Google every
 * call — they're never stored.
 *
 * Refresh tokens are read via `readRefreshToken`, which transparently
 * handles both the Supabase Vault and AES-256 backends.
 */

import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRefreshToken } from "./vault";

export class GmailNotConnectedError extends Error {
  constructor(agentId: string) {
    super(`Gmail is not connected for agent ${agentId}`);
    this.name = "GmailNotConnectedError";
  }
}

export class GmailConfigError extends Error {
  constructor(missing: string) {
    super(`Gmail OAuth is not configured: missing ${missing}`);
    this.name = "GmailConfigError";
  }
}

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId) throw new GmailConfigError("GOOGLE_CLIENT_ID");
  if (!clientSecret) throw new GmailConfigError("GOOGLE_CLIENT_SECRET");
  if (!redirectUri) throw new GmailConfigError("GOOGLE_REDIRECT_URI");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildAuthUrl(state: string): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GMAIL_SCOPES,
    state,
  });
}

export interface GmailClientHandle {
  gmail: gmail_v1.Gmail;
  auth: OAuth2Client;
  emailAddress: string;
  connectionId: string;
}

/** Loads the stored refresh token and returns an authed Gmail client. */
export async function getGmailClient(
  agentId: string,
): Promise<GmailClientHandle> {
  const admin = createAdminClient();

  const { data: conn, error } = await admin
    .from("gmail_connections")
    .select(
      "id, agent_id, email_address, vault_secret_id, encrypted_token, scopes",
    )
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) throw new Error(`gmail_connections lookup failed: ${error.message}`);
  if (!conn) throw new GmailNotConnectedError(agentId);

  const refreshToken = await readRefreshToken(admin, {
    vault_secret_id: (conn.vault_secret_id as string | null) ?? null,
    encrypted_token: (conn.encrypted_token as string | null) ?? null,
  });

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });

  // Fire-and-forget last_used_at update so we can surface connection health
  // in the UI without blocking the send path.
  void admin
    .from("gmail_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", conn.id);

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2 }),
    auth: oauth2,
    emailAddress: String(conn.email_address),
    connectionId: String(conn.id),
  };
}

/** Utility for status endpoints / UI — does NOT read the refresh token. */
export async function getGmailConnectionInfo(agentId: string): Promise<{
  connected: boolean;
  emailAddress: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  scopes: string[];
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gmail_connections")
    .select("email_address, connected_at, last_used_at, scopes")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!data) {
    return {
      connected: false,
      emailAddress: null,
      connectedAt: null,
      lastUsedAt: null,
      scopes: [],
    };
  }
  return {
    connected: true,
    emailAddress: String(data.email_address),
    connectedAt: (data.connected_at as string | null) ?? null,
    lastUsedAt: (data.last_used_at as string | null) ?? null,
    scopes: (data.scopes as string[] | null) ?? [],
  };
}
