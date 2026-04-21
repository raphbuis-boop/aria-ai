import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  GmailConfigError,
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/gmail/client";
import { cacheGet, cacheKey, cacheSet } from "@/lib/gmail/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface MessageSummary {
  id: string;
  threadId: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  date: string | null;
  snippet: string;
  unread: boolean;
  direction: "inbound" | "outbound" | "other";
}

function parseAddress(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      const email = (m ? m[1] : s).trim().toLowerCase();
      return email;
    })
    .filter(Boolean);
}

export async function GET(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const clientEmailRaw = url.searchParams.get("clientEmail");
  const clientEmail = (clientEmailRaw ?? "").trim().toLowerCase();
  if (!clientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    return NextResponse.json(
      { error: "clientEmail required" },
      { status: 400 },
    );
  }

  const ck = cacheKey(user.id, "thread", clientEmail);
  const cached = cacheGet<{ emailAddress: string; messages: MessageSummary[] }>(
    ck,
  );
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  let handle;
  try {
    handle = await getGmailClient(user.id);
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return NextResponse.json(
        { error: "not_connected" },
        { status: 400 },
      );
    }
    if (e instanceof GmailConfigError) {
      return NextResponse.json(
        { error: "not_configured" },
        { status: 501 },
      );
    }
    throw e;
  }
  const { gmail, emailAddress } = handle;

  // Escape quotes in the address so we can put it in the Gmail query.
  const q = `(from:${clientEmail} OR to:${clientEmail} OR cc:${clientEmail}) newer_than:90d`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 50,
  });
  const ids = (list.data.messages ?? []).slice(0, 50);

  const messages = await Promise.all(
    ids.map(async (m) => {
      try {
        const r = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
        });
        const headers: Record<string, string> = {};
        for (const h of r.data.payload?.headers ?? []) {
          if (h.name && h.value) headers[h.name] = h.value;
        }
        const from = headers["From"] ?? null;
        const to = headers["To"] ?? null;
        const labelIds = r.data.labelIds ?? [];

        const fromAddrs = parseAddress(from);
        const toAddrs = parseAddress(to);
        let direction: MessageSummary["direction"] = "other";
        if (fromAddrs.includes(clientEmail)) direction = "inbound";
        else if (toAddrs.includes(clientEmail)) direction = "outbound";

        const summary: MessageSummary = {
          id: String(r.data.id),
          threadId: String(r.data.threadId),
          from,
          to,
          subject: headers["Subject"] ?? null,
          date: headers["Date"] ?? null,
          snippet: r.data.snippet ?? "",
          unread: labelIds.includes("UNREAD"),
          direction,
        };
        return summary;
      } catch {
        return null;
      }
    }),
  );

  const clean = messages.filter((m): m is MessageSummary => m !== null);
  // Newest first.
  clean.sort((a, b) => {
    const da = a.date ? Date.parse(a.date) : 0;
    const db = b.date ? Date.parse(b.date) : 0;
    return db - da;
  });

  const payload = { emailAddress, messages: clean };
  cacheSet(ck, payload);
  return NextResponse.json({ ...payload, cached: false });
}
