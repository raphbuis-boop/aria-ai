import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** `Authorization: Bearer $LEAD_WEBHOOK_SECRET` from a lead source/partner. */
export function bearerMatches(request: Request): boolean {
  const secret = process.env.LEAD_WEBHOOK_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), secret);
}

/** Meta signs webhook bodies with the app secret: `sha256=<hex hmac>`. */
export function metaSignatureMatches(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(header.slice(7), expected);
}

/** Agent that receives leads which don't name one (website form, Meta,
 * texts to the shared Aria number). Unset → those leads aren't auto-created. */
export function defaultLeadAgentId(): string | null {
  return process.env.LEAD_DEFAULT_AGENT_ID?.trim() || null;
}
