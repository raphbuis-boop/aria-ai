import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * WhatsApp business tokens are stored encrypted (AES-256-GCM) with a key that
 * only the server has (WHATSAPP_TOKEN_KEY: 32 random bytes, base64 or hex).
 * A database dump alone never yields a usable token.
 *
 * Format: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url.
 */

function key(): Buffer {
  const raw = process.env.WHATSAPP_TOKEN_KEY?.trim();
  if (!raw) throw new Error("WHATSAPP_TOKEN_KEY is not set");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("WHATSAPP_TOKEN_KEY must be 32 bytes (base64 or 64 hex chars)");
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized token format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
