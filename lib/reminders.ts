import { DEFAULT_TIME_ZONE, differenceInZonedCalendarDays } from "@/lib/time";

/** "today", "tomorrow" or the weekday of an upcoming showing, in the agent's zone. */
export function showingDayLabel(showingIso: string, now: Date, zone: string = DEFAULT_TIME_ZONE): string {
  const days = differenceInZonedCalendarDays(new Date(showingIso), now, zone);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return new Date(showingIso).toLocaleDateString("en-US", { timeZone: zone, weekday: "long" });
}

/** "Thu, Oct 22, 5:00 PM" in the agent's zone (the server clock is UTC). */
export function formatShowingWhen(showingIso: string, zone: string = DEFAULT_TIME_ZONE): string {
  return new Date(showingIso).toLocaleString("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Newest timestamp per client from rows of { client_id, created_at }. */
export function latestByClient(rows: Array<{ client_id: string; created_at: string | null }>): Map<string, number> {
  const latest = new Map<string, number>();
  for (const r of rows) {
    if (!r.created_at) continue;
    const t = new Date(r.created_at).getTime();
    if (t > (latest.get(r.client_id) ?? 0)) latest.set(r.client_id, t);
  }
  return latest;
}

/** Splits ids into chunks small enough for a PostgREST `in` filter in a URL. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
