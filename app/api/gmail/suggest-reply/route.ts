import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { callClaude, sanitizeDraft } from "@/lib/ai";

export const dynamic = "force-dynamic";

interface ThreadMessage {
  from: string;
  date: string;
  body: string;
}

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientName = String(body.clientName ?? "the client");
  const threadMessages: ThreadMessage[] = Array.isArray(body.threadMessages)
    ? body.threadMessages
    : [];

  if (threadMessages.length === 0) {
    return NextResponse.json({ error: "threadMessages required" }, { status: 400 });
  }

  const threadBlock = threadMessages
    .map(
      (m, i) =>
        `Message ${i + 1}\nFrom: ${m.from}\nDate: ${m.date}\n---\n${m.body.slice(0, 800)}`,
    )
    .join("\n\n");

  const system = `You are ghostwriting a professional email reply for a New Jersey real estate agent.
Read the full email thread below and write ONE reply from the agent to ${clientName}.
Tone: warm, professional, concise. Max 3 short paragraphs.
Plain text only — no markdown, no bullet points, no "Here is a draft:" preamble.
Return ONLY the reply body — no subject line, no "Dear", just the message body starting naturally.`;

  const userMsg = `Client name: ${clientName}\n\nThread:\n${threadBlock}\n\nWrite the reply now.`;

  const raw = await callClaude(system, userMsg, 400);
  const suggestion = sanitizeDraft(raw);

  if (!suggestion) {
    return NextResponse.json({ error: "Could not generate reply" }, { status: 500 });
  }

  return NextResponse.json({ suggestion });
}
