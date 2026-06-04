/**
 * MatchingService — thin adapter over lib/matching.ts
 *
 * ZERO weight changes. scoreFuzzyMatch is called byte-for-byte as-is.
 * The regression test in __tests__/services/matching.test.ts verifies parity.
 */

import {
  scoreFuzzyMatch,
  matchBadgeReasons,
  MATCH_MIN_SCORE,
  type MatchClient,
  type MatchProperty,
  type MatchResult,
} from "@/lib/matching";

export type { MatchClient, MatchProperty, MatchResult };
export { MATCH_MIN_SCORE };

export interface IMatchingService {
  score(client: MatchClient, property: MatchProperty): MatchResult;
  badgeReasons(result: MatchResult): string[];
  meetsMinimum(result: MatchResult): boolean;
}

export const MatchingService: IMatchingService = {
  score(client, property) {
    return scoreFuzzyMatch(client, property);
  },

  badgeReasons(result) {
    return matchBadgeReasons(result);
  },

  meetsMinimum(result) {
    return result.score >= MATCH_MIN_SCORE;
  },
};
