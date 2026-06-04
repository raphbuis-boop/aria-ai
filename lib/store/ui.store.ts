/**
 * UI store — Zustand
 *
 * ONLY transient UI state lives here: sheet visibility, drawer open/close,
 * optimistic loading flags, etc. NO server data, NO Supabase rows.
 *
 * Server state (contacts, deals, conversations) belongs in React Query.
 */

import { create } from "zustand";

interface UIState {
  // ─── Ask / Capture sheet ──────────────────────────────────────────────────
  askSheetOpen: boolean;
  openAskSheet: () => void;
  closeAskSheet: () => void;

  // ─── Active contact ID for inline sheet ───────────────────────────────────
  activeContactId: string | null;
  setActiveContactId: (id: string | null) => void;

  // ─── Active deal ID ───────────────────────────────────────────────────────
  activeDealId: string | null;
  setActiveDealId: (id: string | null) => void;

  // ─── Search overlay ───────────────────────────────────────────────────────
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  askSheetOpen: false,
  openAskSheet: () => set({ askSheetOpen: true }),
  closeAskSheet: () => set({ askSheetOpen: false }),

  activeContactId: null,
  setActiveContactId: (id) => set({ activeContactId: id }),

  activeDealId: null,
  setActiveDealId: (id) => set({ activeDealId: id }),

  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
