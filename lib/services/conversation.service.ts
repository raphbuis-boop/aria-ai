/**
 * ConversationService
 *
 * Conversations in the existing app are threads of "activities" rows
 * grouped by client_id. There is no dedicated conversations table.
 * The inbox logic lives in app/(dashboard)/inbox/ and components/InboxSheet.tsx.
 *
 * Phase 2 will consolidate the activities SELECT queries here.
 * All methods are TODO stubs — no Supabase queries duplicated in Phase 1.
 */

import type { Conversation, Message } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface IConversationService {
  /**
   * TODO: Phase 2 — list conversations (one per contact, most-recent-first).
   * Consolidate from app/(dashboard)/inbox/page.tsx activities query.
   */
  list(supabase: SupabaseClient, agentId: string): Promise<Conversation[]>;

  /**
   * TODO: Phase 2 — fetch all messages for a contact's thread.
   * Consolidate from app/(dashboard)/inbox/[contactId] or client detail page.
   */
  messages(supabase: SupabaseClient, contactId: string): Promise<Message[]>;

  /**
   * TODO: Phase 2 — save an AI draft activity (ai_draft: true, approved: false).
   * Consolidate from lib/inbox-drafts.ts and app/api/ai/draft-text/route.ts.
   */
  saveDraft(
    supabase: SupabaseClient,
    params: {
      contactId: string;
      agentId: string;
      body: string;
      type: string;
    },
  ): Promise<Message>;

  /**
   * TODO: Phase 2 — approve a draft (set approved: true).
   * Consolidate from existing inbox approve flow.
   */
  approveDraft(supabase: SupabaseClient, activityId: string): Promise<void>;
}

export const ConversationService: IConversationService = {
  list(_supabase, _agentId) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate activities SELECT from app/(dashboard)/inbox/page.tsx. " +
        "Group by client_id, order by created_at desc.",
    );
  },

  messages(_supabase, _contactId) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate activities SELECT for a single client thread.",
    );
  },

  saveDraft(_supabase, _params) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate from lib/inbox-drafts.ts and /api/ai/draft-text/route.ts.",
    );
  },

  approveDraft(_supabase, _activityId) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate draft-approve PATCH from existing inbox UI.",
    );
  },
};
