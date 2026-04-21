/**
 * Signed state tokens for the Gmail OAuth flow.
 *
 *   state = base64url(JSON({ agentId, nonce, exp })) + "." + hmacSha256
 *
 * The HMAC key is derived from SUPABASE_SERVICE_ROLE_KEY so we don't have
 * to introduce a new env var just for OAuth CSRF protection.  (Service role
 * key is present in every env where the callback runs.)
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

interface StatePayload {
  agentId: string;
  nonce: string;
  exp: number;
}

const TTL_MS = 10 * 60 * 1000;

function getSecret(): Buffer {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for OAuth state signing",
    );
  }
  return createHmac("sha256", "aria-gmail-oauth-v1").update(raw).digest();
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4);
  const padded = s + "=".repeat(pad === 4 ? 0 : pad);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
}

export function signState(agentId: string): string {
  const payload: StatePayload = {
    agentId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + TTL_MS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expectedSig = b64url(
    createHmac("sha256", getSecret()).update(body).digest(),
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as StatePayload;
    if (!payload.agentId || !payload.nonce || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
