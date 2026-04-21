import { NextResponse } from "next/server";
import type { gmail_v1 } from "googleapis";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  GmailConfigError,
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/gmail/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function decodeBody(data: string | null | undefined): string {
  if (!data) return "";
  try {
    const padded = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  html: string | null;
  text: string | null;
} {
  if (!payload) return { html: null, text: null };
  let html: string | null = null;
  let text: string | null = null;

  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.mimeType === "text/html" && p.body?.data) {
      html = html ?? decodeBody(p.body.data);
    } else if (p.mimeType === "text/plain" && p.body?.data) {
      text = text ?? decodeBody(p.body.data);
    }
    for (const part of p.parts ?? []) walk(part);
  };
  walk(payload);

  if (!html && !text && payload.body?.data) {
    text = decodeBody(payload.body.data);
  }
  return { html, text };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let handle;
  try {
    handle = await getGmailClient(user.id);
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "not_connected" }, { status: 400 });
    }
    if (e instanceof GmailConfigError) {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    throw e;
  }

  const r = await handle.gmail.users.messages.get({
    userId: "me",
    id: params.id,
    format: "full",
  });
  const headers: Record<string, string> = {};
  for (const h of r.data.payload?.headers ?? []) {
    if (h.name && h.value) headers[h.name] = h.value;
  }
  const { html, text } = extractBody(r.data.payload ?? undefined);

  return NextResponse.json({
    id: r.data.id,
    threadId: r.data.threadId,
    headers: {
      from: headers["From"] ?? null,
      to: headers["To"] ?? null,
      cc: headers["Cc"] ?? null,
      subject: headers["Subject"] ?? null,
      date: headers["Date"] ?? null,
      messageId: headers["Message-Id"] ?? headers["Message-ID"] ?? null,
    },
    html,
    text,
    snippet: r.data.snippet ?? null,
    labelIds: r.data.labelIds ?? [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const markRead = body.markRead === true;
  const markUnread = body.markUnread === true;
  if (!markRead && !markUnread) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  let handle;
  try {
    handle = await getGmailClient(user.id);
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "not_connected" }, { status: 400 });
    }
    if (e instanceof GmailConfigError) {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    throw e;
  }

  await handle.gmail.users.messages.modify({
    userId: "me",
    id: params.id,
    requestBody: markRead
      ? { removeLabelIds: ["UNREAD"] }
      : { addLabelIds: ["UNREAD"] },
  });

  return NextResponse.json({ ok: true });
}
