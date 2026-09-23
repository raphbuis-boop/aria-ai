"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Calendar, CheckCheck, Clock, Home, Inbox, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { relTime } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  related_client_id: string | null;
  read: boolean;
  created_at: string;
};

const KIND_ICON: Record<string, React.ElementType> = {
  showing_reminder: Calendar,
  engagement_alert: Users,
  task_due: Clock,
  inquiry_received: Inbox,
  match_found: Home,
};

function hrefFor(n: Notification): string {
  if (n.related_client_id) return `/clients/${n.related_client_id}`;
  if (n.kind === "showing_reminder") return "/showings";
  if (n.kind === "inquiry_received") return "/inquiries";
  return "/dashboard";
}

/** Bell + dropdown over the agent's `notifications` rows (new leads, BBA
 * signed, showing reminders…). Polls the unread count every 30s. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: Notification[]; unread?: number };
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* offline — keep last state */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, load]);

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      void fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
    }
    router.push(hrefFor(n));
  }

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-11 items-center justify-center rounded-full bg-secondary text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-hot px-1 text-[10px] font-semibold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[52px] z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_24px_48px_-16px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-body font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-full px-2 py-1 font-display text-caption text-primary"
                >
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              ) : null}
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-center font-display text-body text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center font-display text-body text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openItem(n)}
                    className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/60"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-display text-body ${n.read ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block truncate font-display text-caption text-muted-foreground">{n.body}</span>
                      ) : null}
                      <span className="mt-0.5 block font-display text-[11px] text-muted-foreground/70">{relTime(n.created_at)}</span>
                    </span>
                    {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
