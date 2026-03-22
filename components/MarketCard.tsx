export function MarketCard({
  town,
  avg_sale_price,
  days_on_market,
  price_change_pct,
  inventory_change_pct,
  month_year,
}: {
  town: string;
  avg_sale_price: number | null;
  days_on_market: number | null;
  price_change_pct: number | null;
  inventory_change_pct: number | null;
  month_year: string | null;
}) {
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
      <div className="text-[16px] font-medium text-text-primary">{town}</div>
      <div className="text-[11px] text-text-dim">{month_year}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <div className="text-[11px] text-text-dim">Avg sale</div>
          <div className="text-accent-blue">
            ${avg_sale_price != null ? avg_sale_price.toLocaleString() : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-text-dim">DOM</div>
          <div className="text-text-primary">{days_on_market ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-text-dim">Price chg</div>
          <div className="text-accent-green">
            {price_change_pct != null ? `${price_change_pct}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-text-dim">Inventory chg</div>
          <div className="text-text-muted">
            {inventory_change_pct != null ? `${inventory_change_pct}%` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
