import { describe, expect, it } from "vitest";
import {
  dayKey,
  differenceInZonedCalendarDays,
  monthDayKey,
  startOfZonedDay,
  zonedDayBounds,
  zoneOffsetMs,
} from "@/lib/time";

const HOUR = 3_600_000;

describe("zoned calendar math (America/New_York)", () => {
  it("knows it's still today at 9:30 pm Eastern even though UTC has rolled over", () => {
    const at = new Date("2026-10-23T01:30:00Z"); // Thu Oct 22, 9:30 pm EDT
    expect(dayKey(at)).toBe("2026-10-22");
    const { start, end } = zonedDayBounds(at);
    expect(start.toISOString()).toBe("2026-10-22T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-23T04:00:00.000Z");

    // An 8:30 pm showing is today; tomorrow 9 am is not.
    const showing = new Date("2026-10-23T00:30:00Z");
    const tomorrowMorning = new Date("2026-10-23T13:00:00Z");
    expect(showing >= start && showing < end).toBe(true);
    expect(tomorrowMorning >= start && tomorrowMorning < end).toBe(false);
  });

  it("uses the right offset in winter and summer", () => {
    expect(zoneOffsetMs(new Date("2026-01-15T12:00:00Z"))).toBe(-5 * HOUR);
    expect(zoneOffsetMs(new Date("2026-07-15T12:00:00Z"))).toBe(-4 * HOUR);
  });

  it("has 23- and 25-hour days at the DST changes", () => {
    const spring = zonedDayBounds(new Date("2026-03-08T15:00:00Z")); // DST starts Mar 8
    expect(spring.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);

    const fall = zonedDayBounds(new Date("2026-11-01T15:00:00Z")); // DST ends Nov 1
    expect(fall.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * HOUR);
  });

  it("adds days from local midnight", () => {
    const at = new Date("2026-10-22T16:00:00Z");
    expect(startOfZonedDay(at, undefined, 2).toISOString()).toBe("2026-10-24T04:00:00.000Z");
  });

  it("counts calendar days in the zone, treating bare dates as dates", () => {
    const lateEvening = new Date("2026-10-23T02:00:00Z"); // Oct 22, 10 pm EDT
    expect(differenceInZonedCalendarDays(lateEvening, "2026-10-22")).toBe(0);
    expect(differenceInZonedCalendarDays("2026-10-25", lateEvening)).toBe(3);
    expect(differenceInZonedCalendarDays(new Date("2026-10-22T03:59:00Z"), new Date("2026-10-22T04:00:00Z"))).toBe(-1);
  });

  it("reads month/day for anniversaries without shifting bare dates", () => {
    expect(monthDayKey("1990-10-22")).toBe("10-22");
    expect(monthDayKey(new Date("2026-10-23T01:00:00Z"))).toBe("10-22");
  });
});
