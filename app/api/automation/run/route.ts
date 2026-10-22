import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired. The drip used to run from the browser on every app load: it looped
 * over every client (imported sphere and closed clients included), made one
 * Claude call per eligible client in a single request, wrote drafts no screen
 * showed, and filled Today with "5-day check-in" / "Archive" tasks.
 *
 * Follow-up now comes from Today and Follow-ups (lib/today-items.ts). A
 * server-side, stage-aware cadence engine replaces this (ARIA_MVP_ROADMAP.md,
 * P5). Tabs opened before the deploy may still call this once.
 */
export async function POST() {
  return NextResponse.json({ error: "Automation runs on the server now", processed: 0 }, { status: 410 });
}
