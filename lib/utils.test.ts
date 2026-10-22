import { describe, expect, it } from "vitest";
import { fmtDate, fmtDateTime, fmtMoney, formatPhoneE164, humanizeSource, initials } from "@/lib/utils";

describe("formatPhoneE164", () => {
  it("normalizes US numbers and drops extensions", () => {
    expect(formatPhoneE164("(201) 555-0142")).toBe("+12015550142");
    expect(formatPhoneE164("1-201-555-0142")).toBe("+12015550142");
    expect(formatPhoneE164("201.555.0142 ext. 12")).toBe("+12015550142");
  });

  it("keeps international numbers and rejects junk", () => {
    expect(formatPhoneE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(formatPhoneE164("555-0142")).toBeNull();
    expect(formatPhoneE164("call me")).toBeNull();
  });
});

describe("formatting", () => {
  it("prints bare dates as that date, instants in Eastern time", () => {
    expect(fmtDate("2026-11-01")).toBe("Nov 1");
    expect(fmtDate("2026-11-01T02:00:00Z")).toBe("Oct 31"); // 10 pm EDT
    expect(fmtDateTime("2026-10-22T21:00:00Z")).toBe("Oct 22, 5:00 PM");
    expect(fmtDate(null)).toBe("—");
  });

  it("compacts money and names", () => {
    expect(fmtMoney(1_400_000)).toBe("$1.4M");
    expect(fmtMoney(825_000)).toBe("$825k");
    expect(fmtMoney(null)).toBe("—");
    expect(initials("Marcus Holloway")).toBe("MH");
    expect(initials("")).toBe("?");
    expect(humanizeSource("google_contacts")).toBe("Google Contacts");
    expect(humanizeSource("open_house_walkin")).toBe("Open house walkin");
  });
});
