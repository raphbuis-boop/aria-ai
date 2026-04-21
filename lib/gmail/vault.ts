/**
 * Storage adapter for Gmail refresh tokens.
 *
 * Writes:
 *   • Preferred: Supabase Vault (pgsodium) via the `gmail_vault_*` SQL
 *     wrappers from the 20260420130000 migration.
 *   • Fallback: AES-256-GCM ciphertext stored directly in the
 *     `encrypted_token` column of `gmail_connections`.
 *
 * The caller only talks to `storeRefreshToken` / `readRefreshToken` and
 * never learns which backend was used.
 *
 * All functions MUST be called from server-side code (API routes,
 * server actions) with a service-role Supabase client.  The `authenticated`
 * role cannot read the sensitive columns — see the migration for column-
 * level grants.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decryptToken,
  encryptToken,
  getEncryptionKey,
} from "./encryption";

export type TokenBackend = "vault" | "aes";

export interface StoredTokenLocation {
  backend: TokenBackend;
  /** Only populated when backend === "vault". */
  vaultSecretId?: string;
  /** Only populated when backend === "aes". */
  encryptedToken?: string;
}

/** RPC errors Postgrest returns when the function simply doesn't exist. */
const MISSING_RPC_HINTS = [
  "could not find",
  "does not exist",
  "function public.gmail_vault",
  "pgrst202",
];

function looksLikeMissingRpc(msg: string | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return MISSING_RPC_HINTS.some((h) => lower.includes(h));
}

/** Tries Vault first; falls back to AES-256-GCM. */
export async function storeRefreshToken(
  admin: SupabaseClient,
  agentId: string,
  refreshToken: string,
): Promise<StoredTokenLocation> {
  const vaultName = `gmail_refresh_${agentId}`;
  const { data, error } = await admin.rpc("gmail_vault_insert", {
    p_secret: refreshToken,
    p_name: vaultName,
  });

  if (!error && data) {
    return { backend: "vault", vaultSecretId: data as string };
  }

  if (error && !looksLikeMissingRpc(error.message)) {
    // Vault exists but rejected the write — propagate, don't silently
    // downgrade to AES, because that would hide a legitimate security
    // problem.
    throw new Error(`Supabase Vault insert failed: ${error.message}`);
  }

  // Vault not installed on this project — fall through to AES.
  const key = getEncryptionKey();
  return { backend: "aes", encryptedToken: encryptToken(refreshToken, key) };
}

/** Rewrites an existing stored token (same backend as before). */
export async function updateRefreshToken(
  admin: SupabaseClient,
  location: StoredTokenLocation,
  newRefreshToken: string,
): Promise<StoredTokenLocation> {
  if (location.backend === "vault" && location.vaultSecretId) {
    const { error } = await admin.rpc("gmail_vault_update", {
      p_id: location.vaultSecretId,
      p_secret: newRefreshToken,
    });
    if (error) throw new Error(`Vault update failed: ${error.message}`);
    return location;
  }
  const key = getEncryptionKey();
  return {
    backend: "aes",
    encryptedToken: encryptToken(newRefreshToken, key),
  };
}

/** Resolves a stored location back to the raw refresh token. */
export async function readRefreshToken(
  admin: SupabaseClient,
  row: {
    vault_secret_id: string | null;
    encrypted_token: string | null;
  },
): Promise<string> {
  if (row.vault_secret_id) {
    const { data, error } = await admin.rpc("gmail_vault_get", {
      p_id: row.vault_secret_id,
    });
    if (error) throw new Error(`Vault read failed: ${error.message}`);
    if (typeof data !== "string" || !data) {
      throw new Error("Vault returned an empty secret");
    }
    return data;
  }
  if (row.encrypted_token) {
    return decryptToken(row.encrypted_token, getEncryptionKey());
  }
  throw new Error(
    "gmail_connections row has neither vault_secret_id nor encrypted_token",
  );
}

/** Best-effort deletion — we don't want a failed vault delete to block
 * the user from disconnecting. */
export async function purgeRefreshToken(
  admin: SupabaseClient,
  row: {
    vault_secret_id: string | null;
    encrypted_token: string | null;
  },
): Promise<void> {
  if (row.vault_secret_id) {
    try {
      await admin.rpc("gmail_vault_delete", { p_id: row.vault_secret_id });
    } catch {
      // Best-effort — don't block disconnect on vault cleanup failures.
    }
  }
  // AES rows are deleted when the main row is deleted; nothing else to do.
}
