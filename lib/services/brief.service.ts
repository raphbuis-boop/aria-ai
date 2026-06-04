/**
 * BriefService — thin adapter over lib/mobile-briefing.ts
 *
 * buildMobileBriefing() is called as-is. No new logic invented.
 * The regression test in __tests__/services/brief.test.ts verifies parity.
 */

import {
  buildMobileBriefing,
  isHotLead,
  pipelineTotalCompact,
  type MobileClientRow,
  type MobileTxRow,
} from "@/lib/mobile-briefing";
import type { Brief } from "@/lib/types";

export type { MobileClientRow, MobileTxRow };

export interface IBriefService {
  build(
    clients: MobileClientRow[],
    transactions: MobileTxRow[],
    newMatches: number,
  ): Brief;
  pipelineTotal(clients: { budget_max: number | null }[]): string;
}

export const BriefService: IBriefService = {
  build(clients, transactions, newMatches) {
    const headline = buildMobileBriefing(clients, transactions, newMatches);

    const hotLeadCount = clients.filter(
      (c) => isHotLead(c) && c.status !== "closed",
    ).length;

    const now = Date.now();
    const nearest =
      transactions
        .filter((t) => t.closing_date)
        .map((t) => {
          const days = Math.ceil(
            (new Date(String(t.closing_date)).getTime() - now) /
              (1000 * 60 * 60 * 24),
          );
          return days;
        })
        .filter((d) => d >= 0 && d <= 30)
        .sort((a, b) => a - b)[0] ?? null;

    return {
      headline,
      hotLeadCount,
      newMatchCount: newMatches,
      nearestClosingDays: nearest,
      generatedAt: new Date().toISOString(),
    };
  },

  pipelineTotal(clients) {
    return pipelineTotalCompact(clients);
  },
};
