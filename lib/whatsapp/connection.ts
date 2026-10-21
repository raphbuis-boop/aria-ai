import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./crypto";
import { GraphError, getPhoneNumber } from "./graph";

/** smb_app_data (contacts + history sync) is only accepted this long after onboarding. */
export const SYNC_WINDOW_MS = 24 * 3_600_000;

/** Columns the agent may read about her own connection (never the token). */
export const PUBLIC_COLUMNS =
  "status, status_detail, display_phone_number, verified_name, connected_at, last_webhook_at, last_checked_at, history_status, history_requested_at";

export type ConnectionRow = {
  status: "connected" | "broken" | "disconnected";
  status_detail: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  connected_at: string;
  last_webhook_at: string | null;
  last_checked_at: string | null;
  history_status: string | null;
  history_requested_at: string | null;
};

export function toPublic(row: ConnectionRow | null) {
  if (!row) return null;
  const windowEnds = new Date(new Date(row.connected_at).getTime() + SYNC_WINDOW_MS).toISOString();
  return {
    status: row.status,
    statusDetail: row.status_detail,
    displayPhoneNumber: row.display_phone_number,
    verifiedName: row.verified_name,
    connectedAt: row.connected_at,
    lastWebhookAt: row.last_webhook_at,
    lastCheckedAt: row.last_checked_at,
    historyStatus: row.history_status,
    historyRequestedAt: row.history_requested_at,
    /** Past chats can still be requested until then (once). */
    historyWindowEndsAt: !row.history_requested_at && row.status !== "disconnected" && Date.now() < Date.parse(windowEnds) ? windowEnds : null,
  };
}

/** The agent's connection with its decrypted token — server only. */
export async function loadConnectionWithToken(agentId: string) {
  const { data } = await createAdminClient()
    .from("whatsapp_connections")
    .select("agent_id, waba_id, phone_number_id, access_token_enc, connected_at, history_requested_at, status")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, token: decryptToken(String(data.access_token_enc)) } as {
    agent_id: string;
    waba_id: string;
    phone_number_id: string;
    connected_at: string;
    history_requested_at: string | null;
    status: string;
    token: string;
  };
}

/**
 * Live check against WhatsApp: the token still works and the number is still
 * in coexistence (on the WhatsApp Business app and Cloud API). Records the
 * result as connected / broken.
 */
export async function checkConnection(agentId: string): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let status: "connected" | "broken" = "connected";
  let detail: string | null = null;
  try {
    const conn = await loadConnectionWithToken(agentId);
    if (!conn || conn.status === "disconnected") return;
    const phone = await getPhoneNumber(conn.token, conn.phone_number_id);
    if (phone.is_on_biz_app === false) {
      status = "broken";
      detail = "This number is no longer linked to your WhatsApp Business app. Connect again.";
    }
  } catch (error) {
    status = "broken";
    detail =
      error instanceof GraphError && (error.status === 401 || error.code === 190)
        ? "WhatsApp access expired or was removed. Connect again."
        : "Couldn't reach WhatsApp to check the connection. Try again in a bit.";
  }
  await supabase
    .from("whatsapp_connections")
    .update({ status, status_detail: detail, last_checked_at: now, updated_at: now })
    .eq("agent_id", agentId)
    .neq("status", "disconnected");
}
