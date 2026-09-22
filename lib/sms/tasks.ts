import type { SupabaseClient } from "@supabase/supabase-js";
import { insertNotification, type NotificationKind } from "@/lib/notifications";

/** Things Aria hands to the agent. Surfaced on Today under "Aria needs you". */
export type AriaTaskKind =
  | "aria_showing_approval"
  | "aria_handoff"
  | "aria_client_texted"
  | "aria_reply_failed"
  | "aria_send_failed";

export const ARIA_TASK_KINDS: AriaTaskKind[] = [
  "aria_showing_approval",
  "aria_handoff",
  "aria_client_texted",
  "aria_reply_failed",
  "aria_send_failed",
];

/**
 * Opens a task for the agent (plus a bell notification). If an open task of
 * the same kind already exists for this client it's reused, so a chatty
 * thread doesn't pile up duplicate to-dos. Returns the task id.
 */
export async function openAriaTask(
  supabase: SupabaseClient,
  input: {
    agentId: string;
    clientId: string;
    kind: AriaTaskKind;
    title: string;
    notification?: { kind: NotificationKind; title: string; body?: string; dedupKey?: string };
    /** Always create a new task (e.g. one per showing request). */
    unique?: boolean;
  },
): Promise<string | null> {
  if (!input.unique) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("agent_id", input.agentId)
      .eq("client_id", input.clientId)
      .eq("kind", input.kind)
      .eq("done", false)
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id as string;
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      agent_id: input.agentId,
      client_id: input.clientId,
      title: input.title,
      kind: input.kind,
      due_at: new Date().toISOString(),
      ai_generated: true,
    })
    .select("id")
    .single();
  if (error) console.error("[aria/tasks] insert failed", error.message);

  if (input.notification) {
    await insertNotification(supabase, {
      agent_id: input.agentId,
      kind: input.notification.kind,
      title: input.notification.title,
      body: input.notification.body,
      related_client_id: input.clientId,
      dedup_key: input.notification.dedupKey ?? null,
    });
  }
  return (task?.id as string | undefined) ?? null;
}

/** Closes open Aria tasks of the given kinds for a client (e.g. once the
 * agent replies personally). */
export async function closeAriaTasks(
  supabase: SupabaseClient,
  clientId: string,
  kinds: AriaTaskKind[],
) {
  await supabase
    .from("tasks")
    .update({ done: true })
    .eq("client_id", clientId)
    .in("kind", kinds)
    .eq("done", false);
}
