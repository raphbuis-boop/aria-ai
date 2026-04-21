import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  GmailConfigError,
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

/**
 * Smoke test: fetch 1 message from the connected Gmail account.
 *
 * Intentionally returns only metadata — never full bodies — so it stays
 * safe to inspect the response in a dev tools / logs.
 */
export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { gmail, emailAddress } = await getGmailClient(user.id);
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 1,
      q: "newer_than:90d",
    });
    const ids = list.data.messages ?? [];
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        emailAddress,
        sample: null,
        note: "No messages in the last 90 days.",
      });
    }
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: ids[0].id!,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });
    const headers: Record<string, string> = {};
    for (const h of msg.data.payload?.headers ?? []) {
      if (h.name && h.value) headers[h.name] = h.value;
    }
    return NextResponse.json({
      ok: true,
      emailAddress,
      sample: {
        id: msg.data.id,
        threadId: msg.data.threadId,
        snippet: msg.data.snippet ?? null,
        from: headers["From"] ?? null,
        to: headers["To"] ?? null,
        subject: headers["Subject"] ?? null,
        date: headers["Date"] ?? null,
      },
    });
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return NextResponse.json(
        { ok: false, code: "not_connected" },
        { status: 400 },
      );
    }
    if (e instanceof GmailConfigError) {
      return NextResponse.json(
        { ok: false, code: "not_configured", message: e.message },
        { status: 501 },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
