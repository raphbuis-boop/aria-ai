// Client-safe: no Twilio SDK import, so UI code can explain error codes.

/** Plain-English cause for the Twilio errors an SMS send actually hits. */
export const TWILIO_ERROR_HINTS: Record<number, string> = {
  20003: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN don't belong to the same Twilio account (or the token was rotated)",
  20404: "The Account SID, Messaging Service or phone number wasn't found on this Twilio account",
  21211: "The client's phone number isn't a valid mobile number",
  21408: "SMS to this country isn't enabled on the Twilio account (Geo permissions)",
  21606: "The From number isn't owned by this Twilio account or can't send SMS",
  21608: "Trial account: the recipient must be a verified number in Twilio",
  21610: "The client replied STOP to this number",
  21612: "Twilio can't send from this From number to this recipient",
  21614: "The client's number isn't SMS-capable (landline?)",
  21659: "The From number isn't a Twilio number on this account",
  21704: "The Messaging Service has no phone numbers in its sender pool",
  30003: "Unreachable handset",
  30005: "Unknown or inactive destination number",
  30006: "Landline or unreachable carrier",
  30007: "Carrier filtered the message as spam",
  30032: "Toll-free number isn't verified",
  30034: "US A2P 10DLC: the sending number isn't registered to an approved campaign",
};

export function twilioErrorHint(code: number | string | null | undefined): string | null {
  const n = Number(code);
  return n ? TWILIO_ERROR_HINTS[n] ?? null : null;
}
