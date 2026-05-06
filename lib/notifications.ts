import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "showing_reminder"
  | "engagement_alert"
  | "task_due"
  | "inquiry_received"
  | "match_found";

export type InsertNotificationParams = {
  agent_id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  related_client_id?: string | null;
  related_listing_id?: string | null;
  dedup_key?: string | null;
};

/**
 * Insert a notification, silently skipping duplicates (same agent_id + dedup_key).
 */
export async function insertNotification(
  supabase: SupabaseClient,
  params: InsertNotificationParams,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    agent_id: params.agent_id,
    kind: params.kind,
    title: params.title,
    body: params.body ?? null,
    related_client_id: params.related_client_id ?? null,
    related_listing_id: params.related_listing_id ?? null,
    dedup_key: params.dedup_key ?? null,
  });

  // 23505 = unique_violation — expected when dedup_key already exists
  if (error && error.code !== "23505") {
    console.error("[notifications] insert error", error.message);
  }
}
