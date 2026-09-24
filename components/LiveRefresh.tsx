"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["clients", "activities", "showings", "tasks"] as const;
const POLL_MS = 15_000;

/**
 * Keeps a server-rendered page current: re-renders it (router.refresh) when
 * the agent's rows change. Supabase Realtime drives it when the tables are
 * in the `supabase_realtime` publication; a visible-tab poll and a refresh
 * on focus cover the gap if Realtime is off or the socket drops.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = Date.now();
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        lastRefresh = Date.now();
        router.refresh();
      }, 400);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase.channel(`live-today-${user.id}`);
      for (const table of TABLES) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `agent_id=eq.${user.id}` },
          refresh,
        );
      }
      channel.subscribe();
    });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh >= POLL_MS) refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
