/**
 * Runnable test for the Gmail refresh-token encryption helpers.
 *
 *   npm run test:gmail
 *
 * Uses `node:assert` + `node:test` — no external test runner required
 * beyond `tsx`, which is already a dev dependency.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decryptToken,
  encryptToken,
  generateEncryptionKey,
  getEncryptionKey,
  safeEqual,
} from "../lib/gmail/encryption";

const SAMPLE_TOKEN =
  "1//0abcdefghijklmnopqrstuvwxyz-_0123456789abcdefghijklmnopqrstuvwxyz";

test("round-trips a plausible Google refresh token", () => {
  const key = Buffer.from(generateEncryptionKey(), "hex");
  const cipher = encryptToken(SAMPLE_TOKEN, key);
  assert.notEqual(cipher, SAMPLE_TOKEN);
  assert.match(cipher, /^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(decryptToken(cipher, key), SAMPLE_TOKEN);
});

test("produces different ciphertext each encryption (IV randomness)", () => {
  const key = Buffer.from(generateEncryptionKey(), "hex");
  const a = encryptToken(SAMPLE_TOKEN, key);
  const b = encryptToken(SAMPLE_TOKEN, key);
  assert.notEqual(a, b);
  assert.equal(decryptToken(a, key), SAMPLE_TOKEN);
  assert.equal(decryptToken(b, key), SAMPLE_TOKEN);
});

test("fails loudly if the ciphertext is tampered with", () => {
  const key = Buffer.from(generateEncryptionKey(), "hex");
  const cipher = encryptToken(SAMPLE_TOKEN, key);
  // Flip a byte in the ciphertext section.
  const parts = cipher.split(":");
  const flipped =
    parts[0] +
    ":" +
    parts[1] +
    ":" +
    parts[2] +
    ":" +
    (parts[3].slice(0, -2) + (parts[3].slice(-2) === "00" ? "ff" : "00"));
  assert.throws(() => decryptToken(flipped, key));
});

test("fails with a different key", () => {
  const keyA = Buffer.from(generateEncryptionKey(), "hex");
  const keyB = Buffer.from(generateEncryptionKey(), "hex");
  const cipher = encryptToken(SAMPLE_TOKEN, keyA);
  assert.throws(() => decryptToken(cipher, keyB));
});

test("accepts both hex and base64 encoded keys from env", () => {
  const hex = generateEncryptionKey();
  const base64 = Buffer.from(hex, "hex").toString("base64");

  const fromHex = getEncryptionKey({ GMAIL_ENCRYPTION_KEY: hex });
  const fromB64 = getEncryptionKey({ GMAIL_ENCRYPTION_KEY: base64 });

  assert.equal(fromHex.length, 32);
  assert.equal(fromB64.length, 32);
  assert.ok(fromHex.equals(fromB64));
});

test("rejects malformed keys", () => {
  assert.throws(() => getEncryptionKey({ GMAIL_ENCRYPTION_KEY: "" }));
  assert.throws(() => getEncryptionKey({ GMAIL_ENCRYPTION_KEY: "too-short" }));
  assert.throws(() =>
    getEncryptionKey({ GMAIL_ENCRYPTION_KEY: "zz".repeat(32) }),
  );
});

test("safeEqual behaves like ===", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});
