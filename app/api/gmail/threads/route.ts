import { NextRequest, NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmailClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientEmail = searchParams.get("clientEmail")?.trim();
  if (!clientEmail) {
    return NextResponse.json({ error: "clientEmail required" }, { status: 400 });
  }

  const gmail = await getGmailClient(user.id);
  if (!gmail) {
    return NextResponse.json({ connected: false });
  }

  // Search for threads involving this client email
  const query = `from:${clientEmail} OR to:${clientEmail}`;

  let listRes;
  try {
    listRes = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 10,
    });
  } catch (err) {
    console.error("[gmail/threads] threads.list failed:", err);
    return NextResponse.json({ connected: true, messages: [], error: "fetch_failed" });
  }

  const threadItems = listRes.data.threads ?? [];
  if (threadItems.length === 0) {
    return NextResponse.json({ connected: true, messages: [], totalThreads: 0 });
  }

  // Fetch full messages for the most recent thread
  const threadId = threadItems[0].id!;

  let threadRes;
  try {
    threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
  } catch (err) {
    console.error("[gmail/threads] threads.get failed:", err);
    return NextResponse.json({ connected: true, messages: [], error: "fetch_failed" });
  }

  const messages = (threadRes.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    // Extract plain text body — handle multipart and simple payloads
    let body = "";
    const parts = msg.payload?.parts ?? [];
    const textPart = parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    } else if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
    }

    return {
      id: msg.id,
      from: get("From"),
      to: get("To"),
      subject: get("Subject"),
      date: get("Date"),
      snippet: msg.snippet ?? "",
      body: body.slice(0, 2000),
    };
  });

  return NextResponse.json({
    connected: true,
    threadId,
    messages,
    totalThreads: threadItems.length,
  });
}
