/**
 * Redacts a phone number for safe logging.
 * "+15551234567" → "***1234"
 * Prevents E.164 phone numbers from appearing in Vercel function logs.
 */
export function redactPhone(phone: string): string {
  const last4 = phone.replace(/\D/g, "").slice(-4);
  return `***${last4}`;
}
