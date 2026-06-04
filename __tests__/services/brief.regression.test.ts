/**
 * Regression: BriefService.build() must produce IDENTICAL headlines to
 * lib/mobile-briefing.ts buildMobileBriefing() on fixed fixtures.
 *
 * This test is the moat guard for the morning briefing logic.
 */

import { describe, it, expect } from "vitest";
import { buildMobileBriefing } from "@/lib/mobile-briefing";
import { BriefService } from "@/lib/services/brief.service";
import type { MobileClientRow, MobileTxRow } from "@/lib/mobile-briefing";
import { addDays, format } from "date-fns";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const hotClient: MobileClientRow = {
  id: "c-1",
  name: "Alice Chen",
  town: "Montclair",
  status: "showing", // triggers isHotLead
  lead_score: 7,
  budget_min: 500_000,
  budget_max: 700_000,
  phone: "+19731234567",
};

const coldClient: MobileClientRow = {
  id: "c-2",
  name: "Bob Davis",
  town: "Hoboken",
  status: "active",
  lead_score: 3,
  budget_min: 400_000,
  budget_max: 500_000,
  phone: "+12015559876",
};

const highScoreClient: MobileClientRow = {
  id: "c-3",
  name: "Carol Li",
  town: "Summit",
  status: "active",
  lead_score: 9, // >= 8 → hot
  budget_min: 700_000,
  budget_max: 900_000,
  phone: null,
};

const closedClient: MobileClientRow = {
  id: "c-4",
  name: "Dan Park",
  town: "Montclair",
  status: "closed",
  lead_score: 10, // hot but closed — must NOT appear in hot count
  budget_min: 600_000,
  budget_max: 800_000,
  phone: null,
};

function makeTx(daysFromNow: number): MobileTxRow {
  return {
    id: `tx-${daysFromNow}`,
    client_id: "c-1",
    address: "123 Main St",
    closing_date: format(addDays(new Date(), daysFromNow), "yyyy-MM-dd"),
    status: "active",
  };
}

const noClients: MobileClientRow[] = [];
const noTx: MobileTxRow[] = [];

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("BriefService parity with lib/mobile-briefing.ts", () => {
  it("empty inputs: service headline === raw headline (null)", () => {
    const raw = buildMobileBriefing(noClients, noTx, 0);
    const brief = BriefService.build(noClients, noTx, 0);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toBeNull();
    expect(brief.hotLeadCount).toBe(0);
    expect(brief.newMatchCount).toBe(0);
    expect(brief.nearestClosingDays).toBeNull();
  });

  it("new matches only: headline matches raw", () => {
    const raw = buildMobileBriefing(noClients, noTx, 3);
    const brief = BriefService.build(noClients, noTx, 3);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toBe("3 new property matches overnight");
    expect(brief.newMatchCount).toBe(3);
  });

  it("single new match: headline uses singular form", () => {
    const raw = buildMobileBriefing(noClients, noTx, 1);
    const brief = BriefService.build(noClients, noTx, 1);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toBe("1 new property match overnight");
  });

  it("hot leads: headline matches raw", () => {
    const clients = [hotClient, coldClient];
    const raw = buildMobileBriefing(clients, noTx, 0);
    const brief = BriefService.build(clients, noTx, 0);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toContain("1 hot lead");
    expect(brief.hotLeadCount).toBe(1);
  });

  it("closed hot lead is NOT counted", () => {
    const clients = [closedClient]; // hot score but closed
    const raw = buildMobileBriefing(clients, noTx, 0);
    const brief = BriefService.build(clients, noTx, 0);
    expect(brief.headline).toBe(raw);
    expect(brief.hotLeadCount).toBe(0);
  });

  it("high lead_score triggers hot: >= 8", () => {
    const clients = [highScoreClient]; // lead_score=9
    const raw = buildMobileBriefing(clients, noTx, 0);
    const brief = BriefService.build(clients, noTx, 0);
    expect(brief.headline).toBe(raw);
    expect(brief.hotLeadCount).toBe(1);
  });

  it("closing within 30 days: service headline === raw headline", () => {
    // Uses 10 days to avoid off-by-one edge cases near day boundaries
    const tx = [makeTx(10)];
    const raw = buildMobileBriefing(noClients, tx, 0);
    const brief = BriefService.build(noClients, tx, 0);
    // Core parity — this is the moat guard
    expect(brief.headline).toBe(raw);
    // The headline includes a closing mention when raw does
    if (raw) {
      expect(brief.headline).toContain("closing");
    }
  });

  it("closing today: parity with raw (day arithmetic matches)", () => {
    // Use a specific ISO date string at midnight UTC to avoid fractional-day drift
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const tx: MobileTxRow[] = [
      {
        id: "tx-today",
        client_id: "c-1",
        address: "1 Test St",
        closing_date: format(todayMidnight, "yyyy-MM-dd"),
        status: "active",
      },
    ];
    const raw = buildMobileBriefing(noClients, tx, 0);
    const brief = BriefService.build(noClients, tx, 0);
    // Core parity — service and raw must agree
    expect(brief.headline).toBe(raw);
  });

  it("closing 40 days away: NOT included (safely past the 30-day window)", () => {
    const tx = [makeTx(40)];
    const raw = buildMobileBriefing(noClients, tx, 0);
    const brief = BriefService.build(noClients, tx, 0);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toBeNull();
    expect(brief.nearestClosingDays).toBeNull();
  });

  it("multiple parts: headline joins with · separator", () => {
    const clients = [hotClient, highScoreClient]; // 2 hot leads
    const tx = [makeTx(3)];
    const raw = buildMobileBriefing(clients, tx, 2);
    const brief = BriefService.build(clients, tx, 2);
    expect(brief.headline).toBe(raw);
    expect(brief.headline).toContain("·");
    expect(brief.hotLeadCount).toBe(2);
    expect(brief.newMatchCount).toBe(2);
  });

  it("pipelineTotal: service delegates to pipelineTotalCompact", () => {
    const clients = [
      { budget_max: 600_000 },
      { budget_max: 500_000 },
    ];
    const result = BriefService.pipelineTotal(clients);
    expect(result).toBe("$1.1M");
  });

  it("generatedAt is an ISO string", () => {
    const brief = BriefService.build(noClients, noTx, 0);
    expect(() => new Date(brief.generatedAt)).not.toThrow();
    expect(new Date(brief.generatedAt).toISOString()).toBe(brief.generatedAt);
  });
});
