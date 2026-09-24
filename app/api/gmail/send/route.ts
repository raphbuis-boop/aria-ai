import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmail } from "@/lib/gmail";
import { header } from "@/lib/inbox/triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Header values may never carry CR/LF (header injection). */
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** RFC 2047 for non-ASCII subjects/names. */
function encodeHeader(v: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
}

function buildMime(input: { to: string; subject: string; body: string; inReplyTo?: string; references?: string }): string {
  const lines = [
    `To: ${oneLine(input.to)}`,
    `Subject: ${encodeHeader(oneLine(input.subject))}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${oneLine(input.inReplyTo)}`] : []),
    ...(input.references ? [`References: ${oneLine(input.references)}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * POST /api/gmail/send { to, subject, body, threadId?, clientId? }
 * Sends from the agent's own connected Gmail. With threadId it replies in
 * that thread: Re: subject plus In-Reply-To/References taken from the
 * thread's latest message, so it threads for the recipient too.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const to = oneLine(String(body.to ?? ""));
  let subject = oneLine(String(body.subject ?? ""));
  const messageBody = String(body.body ?? "").trim();
  const threadId = typeof body.threadId === "string" && body.threadId ? body.threadId : null;
  const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;

  const toEmail = to.match(/<([^>]+)>/)?.[1] ?? to;
  if (!EMAIL.test(toEmail) || !messageBody) {
    return NextResponse.json({ error: "A valid recipient and a message are required" }, { status: 400 });
  }
  if (messageBody.length > 20_000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  // Only log against the agent's own client.
  if (clientId) {
    const { data: owned } = await supabase.from("clients").select("id").eq("id", clientId).eq("agent_id", user.id).maybeSingle();
    if (!owned) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const g = await getGmail(user.id);
  if (!g) return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });

  let inReplyTo: string | undefined;
  let references: string | undefined;
  if (threadId) {
    try {
      const t = await g.gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "Message-Id", "References", "Subject"],
      });
      const last = t.data.messages?.at(-1);
      const h = last?.payload?.headers ?? [];
      inReplyTo = header(h, "Message-ID") || header(h, "Message-Id") || undefined;
      references = [header(h, "References"), inReplyTo].filter(Boolean).join(" ") || undefined;
      const original = header(t.data.messages?.[0]?.payload?.headers ?? [], "Subject");
      if (!subject) subject = original;
    } catch {
      return NextResponse.json({ error: "That email thread isn't in your mailbox" }, { status: 404 });
    }
    if (subject && !/^re:/i.test(subject)) subject = `Re: ${subject}`;
  }
  if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });

  let sendRes;
  try {
    sendRes = await g.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: buildMime({ to, subject, body: messageBody, inReplyTo, references }),
        ...(threadId ? { threadId } : {}),
      },
    });
  } catch (err) {
    const e = err as { code?: number; message?: string };
    console.error("[gmail/send] messages.send failed:", e.code, e.message);
    return NextResponse.json({ error: "Gmail couldn't send this message" }, { status: 502 });
  }

  if (clientId) {
    const { error: activityError } = await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "email",
      direction: "outbound",
      body: `To: ${to}\nSubject: ${subject}\n\n${messageBody}`,
      ai_draft: false,
      approved: true,
      sent: true,
      external_id: sendRes.data.id ? `gmail:${sendRes.data.id}` : null,
      metadata: { channel: "gmail", thread_id: sendRes.data.threadId ?? threadId },
    });
    if (activityError) console.error("[gmail/send] activity insert failed:", activityError.message);
  }

  return NextResponse.json({ sent: true, messageId: sendRes.data.id ?? null, threadId: sendRes.data.threadId ?? threadId });
}
