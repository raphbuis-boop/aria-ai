import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { getGmail } from "@/lib/gmail";
import { triageThread, type InboxThread } from "@/lib/inbox/triage";
import { clientsByEmail } from "@/lib/inbox/gmail-data";
import { digestThreads, type ThreadDigest } from "@/lib/inbox/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const METADATA = ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted"];
const DIGEST_MAX = 8;

// Warm-instance cache: a thread is only re-summarized when a new message lands.
// Keyed by agent so one agent's summaries can never be served to another.
const digestCache = new Map<string, ThreadDigest>();

/**
 * GET /api/gmail/inbox — the agent's own Gmail inbox, triaged: known
 * clients first, then threads that need a reply, newsletters/promotions/
 * no-reply last. Top threads carry a one-line AI summary + why it matters.
 */
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const g = await getGmail(user.id);
  if (!g) return NextResponse.json({ connected: false, threads: [] });

  let ids: string[];
  try {
    const list = await g.gmail.users.threads.list({ userId: "me", q: "in:inbox newer_than:30d", maxResults: 40 });
    ids = (list.data.threads ?? []).map((t) => t.id!).filter(Boolean);
  } catch (err) {
    console.error("[gmail/inbox] list failed:", (err as Error).message);
    return NextResponse.json({ connected: true, email: g.email, threads: [], error: "fetch_failed" });
  }

  const clients = await clientsByEmail(supabase, user.id);
  const threads = (
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await g.gmail.users.threads.get({ userId: "me", id, format: "metadata", metadataHeaders: METADATA });
          return triageThread(res.data, g.email, clients);
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((t): t is InboxThread => t !== null)
    .sort((a, b) => b.priority - a.priority);

  const important = threads.filter((t) => !t.lowReason && (t.client || t.needsReply)).slice(0, DIGEST_MAX);
  const key = (t: InboxThread) => `${user.id}:${t.threadId}:${t.lastMessageId}`;
  const missing = important.filter((t) => !digestCache.has(key(t)));
  if (missing.length) {
    const fresh = await digestThreads(
      missing.map((t) => ({
        threadId: t.threadId,
        from: t.from.name,
        client: t.client?.name ?? null,
        subject: t.subject,
        latest: t.snippet,
        ageHours: Math.round(t.ageHours),
      })),
    );
    for (const t of missing) {
      const d = fresh.get(t.threadId);
      if (d) digestCache.set(key(t), d);
    }
    if (digestCache.size > 5000) digestCache.clear();
  }

  return NextResponse.json({
    connected: true,
    email: g.email,
    threads: threads.map((t) => ({ ...t, ai: digestCache.get(key(t)) ?? null })),
  });
}
