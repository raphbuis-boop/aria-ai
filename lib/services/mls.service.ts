/**
 * MlsService — thin adapter over lib/simplyrets.ts
 *
 * Wraps the two public fetch functions. Credentials and auth headers
 * stay entirely in lib/simplyrets.ts — not duplicated here.
 */

import {
  fetchMlsListingsForClient,
  fetchSimplyRetsSingleProperty,
  isSimplyRetsConfigured,
  type MlsListingPayload,
  type SimplyRetsSinglePropertyResult,
} from "@/lib/simplyrets";

export type { MlsListingPayload, SimplyRetsSinglePropertyResult };

export interface IMlsService {
  isConfigured(): boolean;
  fetchForClient(opts: {
    city: string | null | undefined;
    state?: string | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    minBeds?: number | null;
    limit?: number;
  }): Promise<MlsListingPayload[]>;
  fetchSingle(mlsId: string): Promise<SimplyRetsSinglePropertyResult>;
}

export const MlsService: IMlsService = {
  isConfigured() {
    return isSimplyRetsConfigured();
  },

  fetchForClient(opts) {
    return fetchMlsListingsForClient(opts);
  },

  fetchSingle(mlsId) {
    return fetchSimplyRetsSingleProperty(mlsId);
  },
};
