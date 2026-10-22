/**
 * Calendar math in the agent's time zone. Servers (Vercel) run in UTC, so
 * anything that means "today", "tomorrow" or "N days ago" must be computed in
 * the agent's zone, not with Date#setHours / getDate on the server clock.
 */

/** Every agent works in New Jersey today; per-agent zones come with brokerage settings. */
export const DEFAULT_TIME_ZONE = "America/New_York";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(zone: string) {
  let f = dayKeyFormatters.get(zone);
  if (!f) {
    // en-CA formats as YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayKeyFormatters.set(zone, f);
  }
  return f;
}

function partsFormatter(zone: string) {
  let f = partsFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(zone, f);
  }
  return f;
}

/** True for a bare calendar date ("2026-11-01"), as stored in DATE columns. */
export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

/**
 * The calendar date ("YYYY-MM-DD") of an instant in `zone`. A bare date string
 * is already a calendar date and is returned unchanged.
 */
export function dayKey(at: Date | string, zone: string = DEFAULT_TIME_ZONE): string {
  if (typeof at === "string" && isDateOnly(at)) return at;
  return dayKeyFormatter(zone).format(typeof at === "string" ? new Date(at) : at);
}

/** Offset of `zone` from UTC at instant `at`, in ms (−4 h during EDT). */
export function zoneOffsetMs(at: Date, zone: string = DEFAULT_TIME_ZONE): number {
  const parts = partsFormatter(zone).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function utcMidnight(key: string): number {
  const [, y, m, d] = DATE_ONLY.exec(key)!;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** The instant local midnight begins on the calendar day of `at` (+ `addDays`) in `zone`. */
export function startOfZonedDay(at: Date, zone: string = DEFAULT_TIME_ZONE, addDays = 0): Date {
  const target = utcMidnight(dayKey(at, zone)) + addDays * DAY_MS;
  // Local midnight = UTC midnight minus the zone's offset at that moment. The
  // second pass corrects for an offset change (DST) between the two instants.
  let t = target - zoneOffsetMs(new Date(target), zone);
  t = target - zoneOffsetMs(new Date(t), zone);
  return new Date(t);
}

/** [start, end) of the local calendar day containing `at`. */
export function zonedDayBounds(at: Date = new Date(), zone: string = DEFAULT_TIME_ZONE): { start: Date; end: Date } {
  return { start: startOfZonedDay(at, zone), end: startOfZonedDay(at, zone, 1) };
}

/**
 * Whole calendar days from `right` to `left` in `zone` (same argument order as
 * date-fns differenceInCalendarDays). Bare date strings count as that date.
 */
export function differenceInZonedCalendarDays(
  left: Date | string,
  right: Date | string,
  zone: string = DEFAULT_TIME_ZONE,
): number {
  return Math.round((utcMidnight(dayKey(left, zone)) - utcMidnight(dayKey(right, zone))) / DAY_MS);
}

/** "MM-DD" of a date in `zone` — for birthdays and anniversaries. */
export function monthDayKey(at: Date | string, zone: string = DEFAULT_TIME_ZONE): string {
  return dayKey(at, zone).slice(5);
}
