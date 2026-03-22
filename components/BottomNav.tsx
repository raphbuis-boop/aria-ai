"use client";

import { createClient } from "@/lib/supabase/client";
import {
  House,
  LayoutGrid,
  MessageSquare,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "Home", Icon: House },
  { href: "/inbox", label: "Inbox", Icon: MessageSquare, badge: true },
  { href: "/pipeline", label: "Pipeline", Icon: LayoutGrid },
  { href: "/clients", label: "Clients", Icon: Users },
];

function StarIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="white"
      aria-hidden
    >
      <path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17.5 L5.5 22 L8 14 L2 9 L9.5 9 Z" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("ai_draft", true)
        .eq("approved", false);
      if (!cancelled) setUnread(count ?? 0);
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [supabase]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border-card bg-bg-primary">
      <div className="mx-auto flex h-full max-w-lg items-end justify-between px-2 pb-1 pt-1">
        {items.slice(0, 2).map(({ href, label, Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex w-[64px] flex-col items-center gap-[9px] pb-1"
            >
              <span className="relative">
                <Icon
                  className={
                    active ? "text-accent-blue" : "text-text-dim"
                  }
                  size={22}
                  strokeWidth={2}
                />
                {badge && unread > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-accent-blue px-[4px] text-[9px] font-medium text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </span>
              <span
                className={`text-[9px] ${
                  active ? "text-accent-blue" : "text-text-dim"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <div className="relative flex w-[72px] flex-col items-center">
          <Link
            href="/ai"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1D4ED8] text-white"
            style={{ boxShadow: "0 0 0 8px rgba(59,130,246,0.15)" }}
            aria-label="Open Aria AI"
          >
            <StarIcon />
          </Link>
        </div>

        {items.slice(2).map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex w-[64px] flex-col items-center gap-[9px] pb-1"
            >
              <Icon
                className={active ? "text-accent-blue" : "text-text-dim"}
                size={22}
                strokeWidth={2}
              />
              <span
                className={`text-[9px] ${
                  active ? "text-accent-blue" : "text-text-dim"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
