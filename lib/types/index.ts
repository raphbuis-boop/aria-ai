/**
 * Aria v2 Shared TypeScript Types
 *
 * Aligned to the existing Supabase schema. Fields derived from:
 *   - supabase/migrations (clients, activities, notifications, showings,
 *     buyer_broker_agreements, brokerages, agent_profiles tables)
 *   - lib/matching.ts (MatchClient / MatchProperty shapes)
 *   - lib/mobile-briefing.ts (MobileClientRow / MobileTxRow)
 *   - lib/notifications.ts (NotificationKind)
 *   - lib/simplyrets.ts (MlsListingPayload)
 *
 * Fields marked TODO are uncertain — schema was not fully visible in migrations.
 * Do NOT invent fields; add them in Phase 2 once schema is confirmed.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type DealStage =
  | "inquiry"
  | "showing"
  | "offer"
  | "under_contract"
  | "closed"
  | "lost";

export type Channel = "sms" | "email" | "whatsapp";

export type ActionPriority = "high" | "medium" | "low";

export type ContactStatus =
  | "new"
  | "active"
  | "showing"
  | "hot"
  | "under_contract"
  | "closed"
  | "inactive";

// ─── Agent ────────────────────────────────────────────────────────────────────

/** Corresponds to auth.users + agent_profiles rows */
export type Agent = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** TODO: confirm column name from agent_profiles — may be avatar_url */
  avatarUrl: string | null;
  brokerageId: string | null;
};

// ─── Contact ──────────────────────────────────────────────────────────────────

/**
 * Corresponds to public.clients row.
 * "Contact" is the v2 model name; the DB table is still "clients".
 */
export type Contact = {
  id: string;
  agentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: ContactStatus | null;
  /** Legacy single town — use preferredTowns when available */
  town: string | null;
  preferredTowns: string[] | null;
  nearbyTownsOk: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetFlexPct: number;
  bedsWanted: number | null;
  bedFlex: number;
  bathsWanted: number | null;
  bathFlex: number;
  leadScore: number | null;
  clientRole: "buyer" | "seller" | null;
  brokerageId: string | null;
  /** TODO: confirm column name — may be notes or description */
  notes: string | null;
  /** TODO: confirm whether birthday is stored as date or text in schema */
  birthday: string | null;
  /** TODO: confirm column name from 20260525 migration */
  homePurchaseAnniversary: string | null;
  createdAt: string;
  updatedAt: string | null;
};

// ─── Deal ─────────────────────────────────────────────────────────────────────

/**
 * TODO: No dedicated "deals" table was visible in migrations.
 * The existing app uses a "transactions" concept and "opportunities".
 * This type reflects the v2 vision — confirm/align to actual schema in Phase 2.
 * Shape inferred from pipeline board usage in components/PipelineBoard.tsx.
 */
export type Deal = {
  id: string;
  contactId: string;
  agentId: string;
  stage: DealStage;
  /** Property address or MLS number */
  address: string | null;
  closingDate: string | null;
  /** TODO: confirm column — may be list_price or offer_price */
  price: number | null;
  /** TODO: confirm this is a real column or derived */
  commissionPct: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

// ─── Conversation ─────────────────────────────────────────────────────────────

/**
 * A conversation thread between agent and one contact.
 * Backed by the "activities" table grouped by client_id.
 */
export type Conversation = {
  id: string;
  contactId: string;
  agentId: string;
  /** Most recent message preview */
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  channel: Channel;
  /** Count of unread/unapproved AI drafts */
  draftCount: number;
};

// ─── Message ──────────────────────────────────────────────────────────────────

/**
 * A single message in a conversation thread.
 * Corresponds to public.activities row.
 */
export type Message = {
  id: string;
  conversationId: string;
  contactId: string;
  agentId: string;
  body: string;
  /** "text" | "email" | "note" | "call" — matches activities.type */
  type: string;
  /** Inbound (from contact) vs outbound (from agent) */
  direction: "inbound" | "outbound" | null;
  aiDraft: boolean;
  approved: boolean;
  sent: boolean;
  createdAt: string;
};

// ─── Property ─────────────────────────────────────────────────────────────────

/**
 * v2 Property type — wraps MlsListingPayload from lib/simplyrets.ts.
 * Re-exported from that file rather than duplicated.
 */
export type { MlsListingPayload as Property } from "@/lib/simplyrets";

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * A surfaced action item (follow-up, task, reminder).
 * TODO: confirm whether this maps to public.tasks or a derived concept.
 */
export type Action = {
  id: string;
  agentId: string;
  contactId: string | null;
  priority: ActionPriority;
  title: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

// ─── Brief ────────────────────────────────────────────────────────────────────

/**
 * The morning briefing surface — wraps output of lib/mobile-briefing.ts.
 * buildMobileBriefing() returns a string | null; this type wraps the inputs
 * and output for the BriefService.
 */
export type Brief = {
  /** The rendered headline string from buildMobileBriefing() */
  headline: string | null;
  hotLeadCount: number;
  newMatchCount: number;
  /** Nearest closing within 30 days, if any */
  nearestClosingDays: number | null;
  generatedAt: string;
};

// ─── Notification ─────────────────────────────────────────────────────────────

/** Corresponds to public.notifications row + NotificationKind from lib/notifications.ts */
export type { NotificationKind } from "@/lib/notifications";

export type Notification = {
  id: string;
  agentId: string;
  kind: import("@/lib/notifications").NotificationKind;
  title: string;
  body: string | null;
  relatedClientId: string | null;
  relatedListingId: string | null;
  read: boolean;
  dedupKey: string | null;
  createdAt: string;
};
