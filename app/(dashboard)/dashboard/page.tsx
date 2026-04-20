"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone: string | null;
};

const ACTIVE_STATUSES = new Set([
  "new",
  "contacted",
  "showing",
  "offer",
  "under_contract",
]);

export default function DashboardPage() {
  const supabase = createClient();
  const [firstName, setFirstName] = useState("there");
  const [initial, setInitial] = useState("A");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const metaName = user.user_metadata?.full_name as string | undefined;
      const fullName = (profile?.full_name as string | null) ?? metaName ?? "";
      const first = fullName.split(" ")[0] || "there";
      setFirstName(first);
      setInitial(first[0]?.toUpperCase() ?? "A");

      const { data } = await supabase
        .from("clients")
        .select(
          "id, name, town, status, lead_score, budget_min, budget_max, phone",
        )
        .eq("agent_id", user.id)
        .order("lead_score", { ascending: false })
        .limit(50);
      setClients((data as Client[]) ?? []);
      setLoading(false);
    }
    void load();
  }, [supabase]);

  const hotLeads = clients.filter((c) => (c.lead_score ?? 0) >= 7);
  const pipelineTotal = clients
    .filter((c) => ACTIVE_STATUSES.has(c.status ?? ""))
    .reduce((sum, c) => sum + (c.budget_max ?? 0), 0);
  const closingsCount = clients.filter(
    (c) => c.status === "under_contract",
  ).length;
  const firstHot = hotLeads[0];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-5 pt-6 pb-2">
        <p className="text-xs font-semibold text-[#4f7bff] uppercase tracking-widest mb-1">
          {today}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {greeting}, {firstName}
          </h1>
          <div className="w-9 h-9 rounded-full bg-[#4f7bff]/20 flex items-center justify-center text-[#6f9bff] font-bold text-sm">
            {initial}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3 mt-4">
        <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] border border-[#1e2a4e] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f7bff] animate-pulse" />
            <span className="text-xs font-bold text-[#4f7bff] uppercase tracking-widest">
              While you were away
            </span>
          </div>
          <p className="text-sm text-[#a0a0c0] leading-relaxed">
            {loading
              ? "Loading your briefing..."
              : `${hotLeads.length} hot lead${hotLeads.length === 1 ? "" : "s"} need${hotLeads.length === 1 ? "s" : ""} attention. ${clients.length} active client${clients.length === 1 ? "" : "s"} in your pipeline.`}
          </p>
        </div>

        <div className="flex items-center justify-between mt-5 mb-2">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460]">
            Action Stack
          </p>
        </div>

        {firstHot ? (
          <div className="bg-[#12121e] border border-[#2a1a1a] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-0.5">
                Hot Lead
              </span>
              <span className="text-xs text-[#444460]">now</span>
            </div>
            <Link href={`/clients/${firstHot.id}`}>
              <p className="text-base font-semibold mb-1">
                {firstHot.name}
                {firstHot.town ? ` · ${firstHot.town}` : ""}
              </p>
            </Link>
            <p className="text-xs text-[#666680] mb-3 capitalize">
              {(firstHot.status ?? "new").replace("_", " ")}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/inbox?client=${firstHot.id}`}
                className="flex-1 text-center bg-[#4f7bff]/12 text-[#6f9bff] border border-[#4f7bff]/20 rounded-lg py-2 text-xs font-semibold"
              >
                AI text
              </Link>
              {firstHot.phone ? (
                <a
                  href={`tel:${firstHot.phone}`}
                  className="flex-1 text-center bg-green-500/12 text-green-400 border border-green-500/20 rounded-lg py-2 text-xs font-semibold"
                >
                  Call now
                </a>
              ) : (
                <span className="flex-1 text-center bg-green-500/5 text-[#444460] border border-green-500/10 rounded-lg py-2 text-xs font-semibold">
                  No phone
                </span>
              )}
              <Link
                href={`/clients/${firstHot.id}`}
                className="flex-1 text-center bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg py-2 text-xs font-semibold"
              >
                View
              </Link>
            </div>
          </div>
        ) : null}

        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] mt-5 mb-2">
          Stats
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1">
              Pipeline
            </p>
            <p className="text-2xl font-semibold text-[#4f7bff]">
              {fmtMoney(pipelineTotal)}
            </p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1">
              Hot leads
            </p>
            <p className="text-2xl font-semibold text-amber-400">
              {hotLeads.length}
            </p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1">
              Active clients
            </p>
            <p className="text-2xl font-semibold">{clients.length}</p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1">
              Closings
            </p>
            <p className="text-2xl font-semibold text-green-400">
              {closingsCount}
            </p>
          </div>
        </div>

        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] mt-5 mb-2">
          Ask Aria
        </p>
        <Link
          href="/ai"
          className="bg-[#12121e] border border-[#2a2a3e] rounded-2xl p-3.5 flex items-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-[#4f7bff]" />
          <span className="text-sm text-[#555570]">Ask Aria anything...</span>
        </Link>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/clients?new=1"
            className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium"
          >
            + New Client
          </Link>
          <Link
            href="/showings?new=1"
            className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium"
          >
            Log Showing
          </Link>
          <Link
            href="/properties"
            className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium"
          >
            Properties
          </Link>
          <Link
            href="/pipeline"
            className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium"
          >
            Pipeline
          </Link>
        </div>
      </div>
    </div>
  );
}
