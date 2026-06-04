/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ContactService
 *
 * There is no standalone lib/contacts.ts — contact CRUD is performed directly
 * via Supabase in page/component files and API routes. Phase 2 will consolidate
 * those queries here. For now this is a typed interface + TODO stubs.
 *
 * All methods that would require Supabase are left as TODOs.
 * Do NOT duplicate any Supabase queries here in Phase 1.
 */

import type { Contact } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface IContactService {
  /**
   * TODO: Phase 2 — consolidate the Supabase `clients` select queries from
   * app/(dashboard)/clients/page.tsx and related pages into this method.
   */
  list(supabase: SupabaseClient, agentId: string): Promise<Contact[]>;

  /**
   * TODO: Phase 2 — consolidate the single-client fetch from various detail pages.
   */
  get(supabase: SupabaseClient, id: string): Promise<Contact | null>;

  /**
   * TODO: Phase 2 — consolidate the upsert pattern from EditClientModal.tsx.
   */
  upsert(supabase: SupabaseClient, contact: Partial<Contact> & { agentId: string }): Promise<Contact>;

  /**
   * TODO: Phase 2 — consolidate delete from existing UI.
   */
  delete(supabase: SupabaseClient, id: string): Promise<void>;
}

export const ContactService: IContactService = {
  list(_supabase, _agentId) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate Supabase clients SELECT from app/(dashboard)/clients/page.tsx.",
    );
  },

  get(_supabase, _id) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate single-client Supabase fetch from detail pages.",
    );
  },

  upsert(_supabase, _contact) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate upsert from components/EditClientModal.tsx.",
    );
  },

  delete(_supabase, _id) {
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Consolidate delete logic from existing client management UI.",
    );
  },
};
