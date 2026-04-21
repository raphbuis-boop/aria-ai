/**
 * AES-256-GCM encryption for Gmail refresh tokens.
 *
 * Used as a fallback when Supabase Vault (`pgsodium`) isn't available on the
 * current project. Ciphertext format:
 *
 *     v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 *
 * The key comes from `GMAIL_ENCRYPTION_KEY` — 32 raw bytes encoded as either:
 *   • 64 hex chars (e.g. `openssl rand -hex 32`), or
 *   • 44-char base64 (e.g. `openssl rand -base64 32`).
 *
 * Rotating keys: generate a new one, re-encrypt all rows under a new
 * ciphertext prefix (`v2:…`), and keep both versions of the key env vars
 * around until migration is complete. v1 is the only version shipped today.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";
const IV_LEN = 12;
const TAG_LEN = 16;

function parseKey(raw: string | undefined | null): Buffer {
  if (!raw) {
    throw new Error(
      "GMAIL_ENCRYPTION_KEY is not set. Run `openssl rand -hex 32` and add " +
        "the output as GMAIL_ENCRYPTION_KEY in your env.",
    );
  }
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  }
  throw new Error(
    "GMAIL_ENCRYPTION_KEY must be 32 raw bytes encoded as hex (64 chars) " +
      "or base64 (44 chars).",
  );
}

export function getEncryptionKey(
  env: Record<string, string | undefined> = process.env,
): Buffer {
  return parseKey(env.GMAIL_ENCRYPTION_KEY);
}

/** Encrypt a plaintext string.  Returns a portable, self-describing token. */
export function encryptToken(plaintext: string, key: Buffer): string {
  if (!plaintext) throw new Error("encryptToken: empty plaintext");
  if (key.length !== 32) throw new Error("encryptToken: key must be 32 bytes");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt a token produced by `encryptToken`.  Throws on tamper or bad key. */
export function decryptToken(token: string, key: Buffer): string {
  if (!token) throw new Error("decryptToken: empty token");
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`decryptToken: unsupported token format (${parts[0]})`);
  }
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const ciphertext = Buffer.from(parts[3], "hex");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("decryptToken: malformed token");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/**
 * Generates a fresh random key — useful for tests or for an operator who
 * needs a quick way to mint a production key without reaching for openssl.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

/** Constant-time string compare so callers can avoid timing leaks. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
