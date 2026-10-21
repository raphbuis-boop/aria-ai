import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/whatsapp/crypto";
import {
  GRAPH_VERSION,
  GraphError,
  exchangeCode,
  listPhoneNumbers,
  requestSync,
  subscribeApp,
  unsubscribeApp,
  wabaIdFromToken,
  whatsAppEnv,
} from "@/lib/whatsapp/graph";
import { PUBLIC_COLUMNS, checkConnection, loadConnectionWithToken, toPublic, type ConnectionRow } from "@/lib/whatsapp/connection";
import { DEFAULT_REPLY_ALERT_HOURS, loadReplyAlertHours } from "@/lib/whatsapp/followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Settings → WhatsApp.
 *  GET    status (?check=1 also checks the connection live with WhatsApp)
 *  POST   { code, wabaId?, phoneNumberId?, businessId?, importHistory } — finish Embedded Signup (coexistence)
 *  PATCH  { replyAlertHours } — when an unanswered client message shows up in Follow-ups
 *  DELETE disconnect
 */
export async function GET(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (new URL(req.url).searchParams.get("check") === "1") await checkConnection(user.id).catch(() => {});

  const env = whatsAppEnv();
  const [{ data }, replyAlertHours] = await Promise.all([
    supabase.from("whatsapp_connections").select(PUBLIC_COLUMNS).eq("agent_id", user.id).maybeSingle(),
    loadReplyAlertHours(supabase, user.id).catch(() => DEFAULT_REPLY_ALERT_HOURS),
  ]);
  return NextResponse.json({
    configured: Boolean(env),
    // Public identifiers the browser needs for the Facebook JS SDK; not secrets.
    appId: env?.appId ?? null,
    configId: env?.configId ?? null,
    graphVersion: GRAPH_VERSION,
    connection: toPublic((data as ConnectionRow | null) ?? null),
    replyAlertHours,
  });
}

function e164(display: string | undefined): string | null {
  const d = (display ?? "").replace(/\D/g, "");
  return d ? `+${d}` : null;
}

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const env = whatsAppEnv();
  if (!env) return NextResponse.json({ error: "WhatsApp isn't set up on this server yet." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "Missing signup code" }, { status: 400 });
  const idOf = (v: unknown) => (typeof v === "string" && /^\d{5,25}$/.test(v) ? v : null);

  const admin = createAdminClient();
  try {
    // The code is only valid for 30 seconds: exchange it first.
    const token = await exchangeCode(env, code);
    const wabaId = idOf(body.wabaId) ?? (await wabaIdFromToken(env, token));
    if (!wabaId) return NextResponse.json({ error: "WhatsApp didn't say which account you connected. Try again." }, { status: 502 });

    const numbers = await listPhoneNumbers(token, wabaId);
    const wanted = idOf(body.phoneNumberId);
    const phone = numbers.find((n) => n.id === wanted) ?? numbers.find((n) => n.is_on_biz_app) ?? numbers[0];
    if (!phone) return NextResponse.json({ error: "No WhatsApp number found on that account." }, { status: 502 });

    const { data: taken } = await admin.from("whatsapp_connections").select("agent_id").eq("phone_number_id", phone.id).maybeSingle();
    if (taken && taken.agent_id !== user.id) {
      return NextResponse.json({ error: "That WhatsApp number is already connected to another Aria account." }, { status: 409 });
    }

    // Coexistence: the number is already registered on the WhatsApp Business
    // app, so there's no /register step — subscribe this app to its webhooks.
    await subscribeApp(token, wabaId);

    const now = new Date().toISOString();
    const { error } = await admin.from("whatsapp_connections").upsert(
      {
        agent_id: user.id,
        waba_id: wabaId,
        phone_number_id: phone.id,
        business_id: idOf(body.businessId),
        display_phone_number: e164(phone.display_phone_number),
        verified_name: phone.verified_name ?? null,
        access_token_enc: encryptToken(token),
        status: phone.is_on_biz_app === false ? "broken" : "connected",
        status_detail: phone.is_on_biz_app === false ? "This number isn't on the WhatsApp Business app, so there are no chats to read." : null,
        history_requested_at: null,
        history_status: null,
        last_webhook_at: null,
        last_checked_at: now,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "agent_id" },
    );
    if (error) throw new Error(error.message);

    // One-time sync, allowed only within 24 hours of onboarding: contacts first
    // (their webhooks are discarded), then chat history if she opted in.
    await requestSync(token, phone.id, "smb_app_state_sync").catch((e) =>
      console.error("[whatsapp/connect] contacts sync request failed:", e instanceof Error ? e.message : e),
    );
    if (body.importHistory === true) {
      const ok = await requestSync(token, phone.id, "history")
        .then(() => true)
        .catch((e) => {
          console.error("[whatsapp/connect] history sync request failed:", e instanceof Error ? e.message : e);
          return false;
        });
      await admin
        .from("whatsapp_connections")
        .update({ history_requested_at: ok ? now : null, history_status: ok ? "requested" : "failed" })
        .eq("agent_id", user.id);
    }

    const { data } = await admin.from("whatsapp_connections").select(PUBLIC_COLUMNS).eq("agent_id", user.id).maybeSingle();
    return NextResponse.json({ connection: toPublic((data as ConnectionRow | null) ?? null) });
  } catch (error) {
    const message = error instanceof GraphError ? error.message : "Couldn't finish connecting WhatsApp.";
    console.error("[whatsapp/connect] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: `${message} Try again.` }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { replyAlertHours?: unknown };
  const hours = Number(body.replyAlertHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 72) {
    return NextResponse.json({ error: "Pick between 1 and 72 hours" }, { status: 400 });
  }
  const { error } = await supabase.from("agent_profiles").update({ whatsapp_reply_alert_hours: hours }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conn = await loadConnectionWithToken(user.id).catch(() => null);
  // Stop this app's webhooks for her account; her WhatsApp Business app keeps working as before.
  if (conn) await unsubscribeApp(conn.token, conn.waba_id).catch(() => {});
  await createAdminClient().from("whatsapp_connections").delete().eq("agent_id", user.id);
  await createAdminClient().from("whatsapp_unknown_senders").delete().eq("agent_id", user.id);
  return NextResponse.json({ ok: true });
}
