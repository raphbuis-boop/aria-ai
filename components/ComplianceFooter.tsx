import {
  AGENT_LICENSE,
  AGENT_NAME,
  BROKERAGE_ADDRESS,
  BROKERAGE_LICENSE,
  BROKERAGE_NAME,
  BROKERAGE_PHONE,
  EQUAL_HOUSING_DISCLOSURE,
} from "@/lib/compliance";

export function ComplianceFooter() {
  return (
    <footer className="border-t border-border-card bg-bg-card/80 px-4 py-5 text-[12px] text-text-dim">
      <div className="mx-auto max-w-5xl space-y-1">
        <p>
          {AGENT_NAME} · License {AGENT_LICENSE}
        </p>
        <p>
          {BROKERAGE_NAME} · Brokerage License {BROKERAGE_LICENSE}
        </p>
        <p>
          {BROKERAGE_ADDRESS} · {BROKERAGE_PHONE}
        </p>
        <p className="pt-1 text-[11px]">{EQUAL_HOUSING_DISCLOSURE}</p>
      </div>
    </footer>
  );
}
