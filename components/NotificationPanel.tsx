"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Calendar, CheckCheck, Clock, Home, Inbox, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  kind: "showing_reminder" | "engagement_alert" | "task_due" | "inquiry_received" | "match_found";
  title: string;
  body: string | null;
  related_client_id: string | null;
  related_listing_id: string | null;
  read: boolean;
  created_at: string;
};

const KIND_CONFIG: Record<
  Notification["kind"],
  { Icon: React.ElementType; color: string; bg: string; href: (n: Notification) => string }
> = {
  showing_reminder: {
    Icon: Calendar,
    color: "text-blue-400",
    bg: "bg-blue-500/12",
    href: () => "/showings",
  },
  engagement_alert: {
    Icon: Users,
    color: "text-yellow-400",
    bg: "bg-yellow-500/12",
    href: (n) => (n.related_client_id ? `/clients/${n.related_client_id}` : "/clients"),
  },
  task_due: {
    Icon: Clock,
    color: "text-purple-400",
    bg: "bg-purple-500/12",
    href: (n) => (n.related_client_id ? `/clients/${n.related_client_id}` : "/clients"),
  },
  inquiry_received: {
    Icon: Inbox,
    color: "text-green-400",
    bg: "bg-green-500/12",
    // SMS leads carry a client; IDX form inquiries don't.
    href: (n) => (n.related_client_id ? `/clients/${n.related_client_id}` : "/inquiries"),
  },
  match_found: {
    Icon: Home,
    color: "text-[#6b8fff]",
    bg: "bg-[#3a65f0]/12",
    href: (n) => (n.related_client_id ? `/clients/${n.related_client_id}` : "/mls"),
  },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notifications");
    const data = (await res.json()) as {
      notifications?: Notification[];
      unread?: number;
    };
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
    setLoading(false);
  }, []);

  // Poll unread count every 15s
  useEffect(() => {
    async function pollUnread() {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = (await res.json()) as { unread?: number; notifications?: Notification[] };
        setUnread(data.unread ?? 0);
        if (!open) setNotifications(data.notifications ?? []);
      }
    }
    pollUnread();
    const id = setInterval(pollUnread, 15000);
    return () => clearInterval(id);
  }, [open]);

  // Open → fetch fresh list
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnread((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }, []);

  const handleNotificationClick = useCallback(
    async (n: Notification) => {
      if (!n.read) await markRead(n.id);
      const href = KIND_CONFIG[n.kind].href(n);
      setOpen(false);
      router.push(href);
    },
    [markRead, router],
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-[18px] text-[#3a3a52] transition-all"
      >
        {unread > 0 ? <Bell size={20} strokeWidth={2} /> : <Bell size={20} strokeWidth={2} />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-md bg-[#c43838] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 z-[95] w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#1e2230] bg-[#0d0f16] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1e2230] px-4 py-3">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#6b7090]">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#6b8fff] hover:text-blue-300"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#333350] hover:text-[#9498b0]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <span className="text-[12px] text-[#6b7090]">Loading…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <BellOff size={24} className="text-[#2a2e40]" />
                <p className="text-[12px] text-[#6b7090]">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const cfg = KIND_CONFIG[n.kind];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={[
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                          "border-b border-[#111118] last:border-b-0",
                          n.read
                            ? "hover:bg-[#0d0f16]"
                            : "bg-[#12121e] hover:bg-[#14142a]",
                        ].join(" ")}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] ${cfg.bg}`}
                        >
                          <cfg.Icon size={13} className={cfg.color} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[12.5px] leading-snug ${
                              n.read
                                ? "font-normal text-[#9498b0]"
                                : "font-semibold text-[#e8eaf2]"
                            }`}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-0.5 truncate text-[11px] text-[#555570]">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-[#333350]">
                            {relTime(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3a65f0]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
