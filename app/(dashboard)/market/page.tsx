"use client";

import { MarketCard } from "@/components/MarketCard";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type Row = {
  town: string;
  avg_sale_price: number | null;
  inventory_count: number | null;
  days_on_market: number | null;
  price_change_pct: number | null;
  inventory_change_pct: number | null;
  month_year: string | null;
};

export default function MarketPage() {
  const supabase = createClient();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [town, setTown] = useState("Ridgewood");
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("market_data").select("*");
      setRows((data as Row[]) ?? []);
    })();
  }, [supabase]);

  const selected = useMemo(
    () => rows.find((r) => r.town === town) ?? rows[0],
    [rows, town],
  );

  useEffect(() => {
    void (async () => {
      if (!selected) return;
      const res = await fetch("/api/ai/market-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          town: selected.town,
          stats: selected,
        }),
      });
      const data = await res.json();
      setInsight(String(data.insight ?? ""));
    })();
  }, [selected]);

  async function copyBrief() {
    const text = `${selected?.town} — Avg ${selected?.avg_sale_price}, DOM ${selected?.days_on_market}. ${insight ?? ""}`;
    await navigator.clipboard.writeText(text);
    toast.toast("Copied", "success");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <header>
        <div className="text-[20px] font-medium text-text-primary">
          Market Pulse
        </div>
        <div className="text-[13px] text-text-dim">NJ real estate trends</div>
      </header>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {rows.map((r) => (
          <button
            key={r.town}
            type="button"
            onClick={() => setTown(r.town)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              town === r.town
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {r.town}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mt-4">
          <MarketCard
            town={selected.town}
            avg_sale_price={selected.avg_sale_price}
            days_on_market={selected.days_on_market}
            price_change_pct={selected.price_change_pct}
            inventory_change_pct={selected.inventory_change_pct}
            month_year={selected.month_year}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
          Loading market data…
        </div>
      )}
      <div className="mt-4 rounded-[14px] border border-border-card bg-bg-card p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          AI Insight
        </div>
        <p className="mt-2 text-[13px] text-text-secondary">{insight}</p>
        <button
          type="button"
          onClick={copyBrief}
          className="mt-3 rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] font-medium text-white"
        >
          Copy Market Brief
        </button>
      </div>
    </div>
  );
}
