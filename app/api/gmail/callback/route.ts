import { NextResponse } from "next/server";
import { google } from "googleapis";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GMAIL_SCOPES,
  GmailConfigError,
  getOAuth2Client,
} from "@/lib/gmail/client";
import { verifyState } from "@/lib/gmail/state";
import {
  purgeRefreshToken,
  storeRefreshToken,
  updateRefreshToken,
} from "@/lib/gmail/vault";

export const dynamic = "force-dynamic";

function redirectTo(path: string, msg?: string): NextResponse {
  const url = new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  if (msg) url.searchParams.set("gmail", msg);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const errorParam = u.searchParams.get("error");

  if (errorParam) {
    return redirectTo("/settings", `error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return redirectTo("/settings", "error=missing_code");
  }

  const payload = verifyState(state);
  if (!payload) {
    return redirectTo("/settings", "error=invalid_state");
  }

  let oauth2;
  try {
    oauth2 = getOAuth2Client();
  } catch (e) {
    if (e instanceof GmailConfigError) {
      return redirectTo("/settings", "error=not_configured");
    }
    throw e;
  }

  let tokenRes;
  try {
    tokenRes = await oauth2.getToken(code);
  } catch {
    return redirectTo("/settings", "error=token_exchange_failed");
  }

  const { tokens } = tokenRes;
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    // Google only returns refresh_token the first time; force re-consent
    // on reconnect by passing prompt=consent (we already do in authUrl).
    return redirectTo("/settings", "error=no_refresh_token");
  }

  oauth2.setCredentials(tokens);
  let email: string | null = null;
  try {
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const me = await oauth2Api.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    // fall through
  }
  if (!email) {
    return redirectTo("/settings", "error=no_email");
  }

  const admin = createAdminClient();
  const scopes = (tokens.scope ?? GMAIL_SCOPES.join(" "))
    .split(" ")
    .filter(Boolean);

  const { data: existing } = await admin
    .from("gmail_connections")
    .select("id, vault_secret_id, encrypted_token")
    .eq("agent_id", payload.agentId)
    .maybeSingle();

  try {
    if (existing) {
      const loc = await updateRefreshToken(
        admin,
        {
          backend: existing.vault_secret_id ? "vault" : "aes",
          vaultSecretId: (existing.vault_secret_id as string | null) ?? undefined,
          encryptedToken: (existing.encrypted_token as string | null) ?? undefined,
        },
        refreshToken,
      );
      await admin
        .from("gmail_connections")
        .update({
          email_address: email,
          vault_secret_id: loc.vaultSecretId ?? null,
          encrypted_token: loc.encryptedToken ?? null,
          scopes,
          connected_at: new Date().toISOString(),
          last_used_at: null,
        })
        .eq("id", existing.id);
    } else {
      const loc = await storeRefreshToken(
        admin,
        payload.agentId,
        refreshToken,
      );
      const { error: insertErr } = await admin
        .from("gmail_connections")
        .insert({
          agent_id: payload.agentId,
          email_address: email,
          vault_secret_id: loc.vaultSecretId ?? null,
          encrypted_token: loc.encryptedToken ?? null,
          scopes,
        });
      if (insertErr) {
        // Clean up the vault secret we just created so we don't leak it.
        if (loc.backend === "vault" && loc.vaultSecretId) {
          await purgeRefreshToken(admin, {
            vault_secret_id: loc.vaultSecretId,
            encrypted_token: null,
          });
        }
        return redirectTo(
          "/settings",
          `error=${encodeURIComponent(insertErr.message)}`,
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "store_failed";
    return redirectTo("/settings", `error=${encodeURIComponent(msg)}`);
  }

  return redirectTo("/settings", "connected=1");
}
