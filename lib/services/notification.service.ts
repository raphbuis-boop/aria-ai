/**
 * NotificationService — thin adapter over lib/notifications.ts
 *
 * Requires a SupabaseClient — callers must supply one from the appropriate
 * client (server.ts for Server Components / API routes, client.ts for browser).
 * This service never creates its own Supabase connection.
 */

import {
  insertNotification,
  type InsertNotificationParams,
  type NotificationKind,
} from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { InsertNotificationParams, NotificationKind };

export interface INotificationService {
  insert(
    supabase: SupabaseClient,
    params: InsertNotificationParams,
  ): Promise<void>;
}

export const NotificationService: INotificationService = {
  insert(supabase, params) {
    return insertNotification(supabase, params);
  },
};
