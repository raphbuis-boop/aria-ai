/**
 * MIME message builder + Gmail send helper.
 *
 * Uses nodemailer's `MailComposer` to produce RFC 2822 bytes and then
 * hands them to the Gmail API as a base64url-encoded `raw` payload.
 * This gives us proper multipart/alternative + multipart/mixed handling
 * without reimplementing MIME quoting rules.
 */

import MailComposer from "nodemailer/lib/mail-composer";
import type { gmail_v1 } from "googleapis";

export interface OutgoingAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface BuildEmailInput {
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  /** Rich HTML body.  A plain-text alternative is derived automatically. */
  html: string;
  attachments?: OutgoingAttachment[];
  replyTo?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
}

export interface SentEmailMeta {
  gmailMessageId: string;
  gmailThreadId: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function buildRawMime(input: BuildEmailInput): Promise<string> {
  const composer = new MailComposer({
    from: input.fromName ? `${input.fromName} <${input.from}>` : input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: stripHtml(input.html) || " ",
    replyTo: input.replyTo ?? undefined,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
    attachments: (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  const buf: Buffer = await composer.compile().build();
  // Gmail wants base64url (RFC 4648 §5) without padding.
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmail(
  gmail: gmail_v1.Gmail,
  input: BuildEmailInput,
  threadId?: string | null,
): Promise<SentEmailMeta> {
  const raw = await buildRawMime(input);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: threadId ? { raw, threadId } : { raw },
  });
  const data = res.data;
  if (!data.id || !data.threadId) {
    throw new Error("Gmail API did not return message/thread ids");
  }
  return { gmailMessageId: data.id, gmailThreadId: data.threadId };
}
