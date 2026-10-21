"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, LogOut, MessageCircle, RefreshCw, Timer } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/Skeleton";
import { cn, fmtPhone, relTime } from "@/lib/utils";

type Connection = {
  status: "connected" | "broken" | "disconnected";
  statusDetail: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  connectedAt: string;
  lastWebhookAt: string | null;
  historyStatus: string | null;
  historyWindowEndsAt: string | null;
};

type State = {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  connection: Connection | null;
  replyAlertHours: number;
};

type SessionInfo = { wabaId?: string; phoneNumberId?: string; businessId?: string };

// Minimal Facebook JS SDK surface used by Embedded Signup.
type FbLoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FbSdk = {
  init: (o: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
  login: (cb: (r: FbLoginResponse) => void, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const ALERT_HOURS = [1, 2, 4, 8, 12, 24, 48];

/** Loads and initializes the Facebook JS SDK once. */
function loadFacebookSdk(appId: string, version: string): Promise<FbSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: true, version });
      resolve(window.FB!);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("Couldn't load Facebook's sign-in. Check your connection or ad blocker."));
    document.body.appendChild(s);
  });
}

/** Embedded Signup posts its result from facebook.com (or a subdomain). */
function fromFacebook(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function Line({ Icon, label, detail, right, onPress, danger }: {
  Icon: React.ElementType;
  label: string;
  detail?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const body = (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", danger ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground")}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-display text-body-lg", danger ? "font-medium text-destructive" : "text-foreground")}>{label}</p>
        {detail ? <div className="mt-0.5 font-display text-caption text-muted-foreground">{detail}</div> : null}
      </div>
      {right}
    </div>
  );
  return onPress ? (
    <button type="button" onClick={onPress} className="block w-full text-left hover:bg-secondary/40">
      {body}
    </button>
  ) : (
    body
  );
}

function StatusDot({ status }: { status: Connection["status"] | "off" }) {
  const tone = status === "connected" ? "ok" : status === "broken" ? "warn" : "off";
  const label = status === "connected" ? "Connected" : status === "broken" ? "Needs attention" : status === "disconnected" ? "Disconnected" : "Not connected";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-caption font-medium", tone === "ok" ? "text-primary" : tone === "warn" ? "text-warm" : "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-warm" : "bg-muted-foreground/50")} />
      {label}
    </span>
  );
}

/**
 * Settings → WhatsApp: connect the agent's WhatsApp Business app number with
 * Embedded Signup (coexistence) so Aria sees her 1:1 chats with clients. She
 * keeps sending from her phone; Aria never sends through WhatsApp.
 */
export function WhatsAppSettings() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState(true);
  const session = useRef<SessionInfo>({});

  const load = useCallback(async (check = false) => {
    const res = await fetch(`/api/whatsapp${check ? "?check=1" : ""}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setState((await res.json()) as State);
  }, []);

  useEffect(() => {
    void load();
    // Session info from the Embedded Signup popup: which account and number she connected.
    function onMessage(event: MessageEvent) {
      if (!fromFacebook(event.origin)) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(data.event ?? "").startsWith("FINISH")) {
          session.current = {
            wabaId: data.data?.waba_id ?? undefined,
            phoneNumberId: data.data?.phone_number_id ?? undefined,
            businessId: data.data?.business_id ?? undefined,
          };
        } else if (data.event === "CANCEL" && data.data?.error_message) {
          toast.error(`WhatsApp: ${data.data.error_message}`);
        }
      } catch {
        /* not JSON: not ours */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  async function finish(code: string) {
    // The finish event usually lands just before the code; give it a moment.
    for (let i = 0; i < 10 && !session.current.wabaId; i++) await new Promise((r) => setTimeout(r, 150));
    const res = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, ...session.current, importHistory }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Couldn't connect WhatsApp");
    toast.success(importHistory ? "WhatsApp connected — confirm sharing past chats in your WhatsApp Business app" : "WhatsApp connected");
    await load();
  }

  async function connect() {
    if (!state?.appId || !state.configId) return;
    setBusy("connect");
    session.current = {};
    try {
      const FB = await loadFacebookSdk(state.appId, state.graphVersion);
      // FB.login needs a plain (non-async) callback.
      FB.login(
        (response) => {
          const code = response.authResponse?.code;
          if (!code) {
            setBusy(null);
            return;
          }
          finish(code)
            .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't connect WhatsApp"))
            .finally(() => setBusy(null));
        },
        {
          config_id: state.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            // Coexistence: keep using the WhatsApp Business app on her phone.
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start WhatsApp sign-in");
      setBusy(null);
    }
  }

  async function act(name: string, run: () => Promise<Response>, ok: string) {
    setBusy(name);
    try {
      const res = await run();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const conn = state.connection;

  if (!state.configured) {
    return <Line Icon={MessageCircle} label="WhatsApp" detail="Not set up on this server yet (WHATSAPP_* environment variables)." right={<StatusDot status="off" />} />;
  }

  if (!conn || conn.status === "disconnected") {
    return (
      <div>
        <Line
          Icon={MessageCircle}
          label={busy === "connect" ? "Connecting WhatsApp…" : conn ? "Connect WhatsApp again" : "Connect WhatsApp"}
          detail={
            conn?.statusDetail ??
            "Keep using the WhatsApp Business app on your phone. Aria reads your 1:1 chats with clients — nobody else's — and never sends for you."
          }
          right={<StatusDot status={conn ? "disconnected" : "off"} />}
          onPress={busy ? undefined : () => void connect()}
        />
        <label className="flex items-start gap-3 px-4 pb-4 font-display text-caption text-muted-foreground">
          <input type="checkbox" checked={importHistory} onChange={(e) => setImportHistory(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
          <span>
            Also bring in past chats with your clients (up to 6 months). WhatsApp asks you to confirm in the app. Chats with anyone who isn&apos;t a client are never saved.
          </span>
        </label>
      </div>
    );
  }

  const number = conn.displayPhoneNumber ? fmtPhone(conn.displayPhoneNumber) : null;
  const historyLine =
    conn.historyStatus === "complete"
      ? "Past client chats imported."
      : conn.historyStatus === "in_progress"
        ? "Importing past client chats…"
        : conn.historyStatus === "requested"
          ? "Waiting for you to confirm sharing past chats in the WhatsApp Business app."
          : conn.historyStatus === "declined"
            ? "Past chats weren't shared — only new messages come in."
            : null;

  return (
    <div className="divide-y divide-border">
      <Line
        Icon={MessageCircle}
        label="WhatsApp"
        detail={
          <>
            {[conn.verifiedName, number].filter(Boolean).join(" · ") || "WhatsApp Business app"}
            {conn.status === "broken" && conn.statusDetail ? <span className="block text-warm">{conn.statusDetail}</span> : null}
            {conn.lastWebhookAt ? <span className="block">Last message {relTime(conn.lastWebhookAt)}</span> : null}
            {historyLine ? <span className="block">{historyLine}</span> : null}
          </>
        }
        right={<StatusDot status={conn.status} />}
      />
      {conn.status === "broken" ? (
        <Line Icon={MessageCircle} label={busy === "connect" ? "Connecting…" : "Connect again"} onPress={busy ? undefined : () => void connect()} />
      ) : null}
      {conn.historyWindowEndsAt ? (
        <Line
          Icon={History}
          label={busy === "history" ? "Requesting…" : "Bring in past client chats"}
          detail={`Up to 6 months. Available until ${new Date(conn.historyWindowEndsAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}.`}
          onPress={busy ? undefined : () => void act("history", () => fetch("/api/whatsapp/history", { method: "POST" }), "Requested — confirm in your WhatsApp Business app")}
        />
      ) : null}
      <label className="flex min-h-[56px] items-center gap-3 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
          <Timer className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-body-lg text-foreground">Unanswered alert</span>
          <span className="block font-display text-caption text-muted-foreground">When a client&apos;s message shows up in Follow-ups</span>
        </span>
        <select
          aria-label="Hours before an unanswered message shows in Follow-ups"
          value={state.replyAlertHours}
          onChange={(e) => {
            const hours = Number(e.target.value);
            void act(
              "hours",
              () => fetch("/api/whatsapp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replyAlertHours: hours }) }),
              "Saved",
            );
          }}
          className="shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 font-display text-caption text-foreground"
        >
          {ALERT_HOURS.map((h) => (
            <option key={h} value={h}>
              After {h}h
            </option>
          ))}
        </select>
      </label>
      <Line Icon={RefreshCw} label={busy === "check" ? "Checking…" : "Check connection"} detail="Asks WhatsApp whether Aria can still read this number. Sends nothing." onPress={busy ? undefined : () => { setBusy("check"); void load(true).finally(() => setBusy(null)); }} />
      <Line
        Icon={LogOut}
        label="Disconnect WhatsApp"
        detail="Aria stops receiving chats. Your WhatsApp Business app isn't affected; chats already saved stay on your clients."
        danger
        onPress={busy ? undefined : () => void act("disconnect", () => fetch("/api/whatsapp", { method: "DELETE" }), "WhatsApp disconnected")}
      />
    </div>
  );
}
