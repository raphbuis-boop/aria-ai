import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption at rest for Google OAuth tokens (gmail_integrations), which
 * grant access to the agent's mailbox and calendar. AES-256-GCM with the key
 * in GOOGLE_TOKEN_ENCRYPTION_KEY (32 random bytes, base64:
 * `openssl rand -base64 32`).
 *
 * Rolls out without a migration: sealed values carry a prefix, plaintext
 * rows written before the key existed still open, and without a key tokens
 * are stored as before.
 */
const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer | null {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypts a token for storage (unchanged when no key is configured). */
export function sealToken(plain: string): string {
  const key = encryptionKey();
  if (!key) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Decrypts a stored token; plaintext from before encryption passes through. */
export function openToken(stored: string): string {
  if (!isSealed(stored)) return stored;
  const key = encryptionKey();
  if (!key) throw new Error("A Google token is encrypted but GOOGLE_TOKEN_ENCRYPTION_KEY is not set");
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}

/** True when tokens should be (re)sealed: a key is set and the value isn't sealed yet. */
export function needsSealing(stored: string): boolean {
  return !isSealed(stored) && encryptionKey() !== null;
}
