/**
 * DealService
 *
 * The DB schema visible in migrations uses "transactions" and "opportunities"
 * tables, not a "deals" table. The v2 type system models a unified Deal concept.
 * Phase 2 must decide whether to migrate the schema or map the existing tables.
 *
 * All methods are TODO stubs — no Supabase queries are duplicated here.
 */

import type { Deal } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface IDealService {
  /**
   * TODO: Phase 2 — map from public.transactions or public.opportunities
   * (whichever table the pipeline board actually reads). Check
   * app/(dashboard)/pipeline/page.tsx and components/PipelineBoard.tsx.
   */
  list(supabase: SupabaseClient, agentId: string): Promise<Deal[]>;

  /**
   * TODO: Phase 2 — single deal fetch with stage history.
   */
  get(supabase: SupabaseClient, id: string): Promise<Deal | null>;

  /**
   * TODO: Phase 2 — stage advance. Confirm whether this writes to transactions
   * or a separate stage_history table.
   */
  advanceStage(supabase: SupabaseClient, dealId: string, stage: Deal["stage"]): Promise<Deal>;

  /**
   * TODO: Phase 2 — upsert deal from pipeline board drag.
   */
  upsert(supabase: SupabaseClient, deal: Partial<Deal> & { agentId: string; contactId: string }): Promise<Deal>;
}

export const DealService: IDealService = {
  list(_supabase, _agentId) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Map from public.transactions or public.opportunities — check " +
        "app/(dashboard)/pipeline/page.tsx to confirm which table is used.",
    );
  },

  get(_supabase, _id) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Single deal/transaction fetch — confirm table name first.",
    );
  },

  advanceStage(_supabase, _dealId, _stage) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Stage advance — confirm whether transactions.status maps to DealStage.",
    );
  },

  upsert(_supabase, _deal) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Deal upsert — confirm target table (transactions vs opportunities).",
    );
  },
};
