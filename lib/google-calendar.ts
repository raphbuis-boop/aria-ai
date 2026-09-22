import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/gmail";

const WRITE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];
const SHOWING_MINUTES = 60;

async function calendarFor(agentId: string) {
  const g = await getGoogleAuth(agentId);
  if (!g) return null;
  return {
    calendar: google.calendar({ version: "v3", auth: g.auth }),
    canWrite: g.scopes.some((s) => WRITE_SCOPES.includes(s)),
  };
}

/**
 * Events on the agent's primary Google Calendar overlapping a one-hour
 * showing at `startIso`. Works with the existing calendar.readonly scope.
 * Null when Google isn't connected or the lookup fails.
 */
export async function findCalendarConflicts(
  agentId: string,
  startIso: string,
): Promise<string[] | null> {
  try {
    const c = await calendarFor(agentId);
    if (!c) return null;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + SHOWING_MINUTES * 60_000);
    const res = await c.calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    return (res.data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent")
      .map((e) => e.summary || "Busy");
  } catch (error) {
    console.error("[calendar] conflict check failed", error);
    return null;
  }
}

/**
 * Puts an approved showing on the agent's Google Calendar. Requires the
 * calendar.events scope (enable with GOOGLE_CALENDAR_WRITE=1 and reconnect
 * Google); returns null without it.
 */
export async function createShowingEvent(
  agentId: string,
  showing: { startIso: string; address: string | null; clientName: string; clientPhone: string | null },
): Promise<string | null> {
  try {
    const c = await calendarFor(agentId);
    if (!c?.canWrite) return null;
    const start = new Date(showing.startIso);
    const end = new Date(start.getTime() + SHOWING_MINUTES * 60_000);
    const res = await c.calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Showing: ${showing.address ?? "home"} · ${showing.clientName}`,
        location: showing.address ?? undefined,
        description: `Booked by Aria over SMS.${showing.clientPhone ? ` Client: ${showing.clientPhone}` : ""}`,
        start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
        end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      },
    });
    return res.data.id ?? null;
  } catch (error) {
    console.error("[calendar] create showing event failed", error);
    return null;
  }
}
