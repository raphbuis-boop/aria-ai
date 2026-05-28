import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmailClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";

function buildMimeMessage({
  to,
  subject,
  body,
  threadId,
}: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ];
  if (threadId) {
    // Insert In-Reply-To header to thread correctly
    lines.splice(2, 0, `In-Reply-To: ${threadId}`);
  }
  const raw = lines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const messageBody = String(body.body ?? "").trim();
  const threadId = body.threadId as string | undefined;
  const clientId = body.clientId as string | undefined;

  if (!to || !subject || !messageBody) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 },
    );
  }

  const gmail = await getGmailClient(user.id);
  if (!gmail) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });
  }

  const raw = buildMimeMessage({ to, subject, body: messageBody, threadId });

  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      ...(threadId ? { threadId } : {}),
    },
  });

  const messageId = sendRes.data.id ?? null;

  // Log to activities table
  if (clientId) {
    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "email",
      body: `To: ${to}\nSubject: ${subject}\n\n${messageBody}`,
      ai_draft: false,
      approved: true,
      sent: true,
    });
  }

  return NextResponse.json({ sent: true, messageId });
}
