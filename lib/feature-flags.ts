/**
 * Server-side feature flags. Read from env at request time, never exposed
 * to the browser directly — pages pass the resolved boolean down as a prop.
 */

/**
 * Aria texting leads from a Twilio number (first-touch texts, inbound
 * replies, showing confirmations, BBA links). Off by default: the number
 * needs US A2P 10DLC registration before carriers deliver its texts, and
 * until then Aria only drafts — the agent sends from their own phone.
 * Set ARIA_SMS_ENABLED=1 to turn it back on. All Twilio code stays in place.
 */
export function ariaSmsEnabled(): boolean {
  return process.env.ARIA_SMS_ENABLED === "1";
}

export const ARIA_SMS_OFF_MESSAGE = "Aria texting is off — drafts open in your Messages app instead.";
