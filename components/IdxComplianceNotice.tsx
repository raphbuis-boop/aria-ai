import {
  AGENT_LICENSE,
  AGENT_NAME,
  EQUAL_HOUSING_DISCLOSURE,
  getIdxDisclaimerText,
  NJMLS_IDX_LOGO_PATH,
} from "@/lib/compliance";

export function IdxComplianceNotice({
  lastUpdated,
  brokerageName,
  compact = false,
  logoSize = "default",
  /** Agent + license line; omit on public IDX (shown in site footer instead). */
  includeAgentAttribution = true,
}: {
  lastUpdated?: string | null;
  brokerageName?: string | null;
  compact?: boolean;
  /** Larger mark + disclaimer block for public IDX pages (NJMLS visibility). */
  logoSize?: "default" | "prominent";
  includeAgentAttribution?: boolean;
}) {
  const effectiveLogo =
    compact || logoSize !== "prominent" ? "default" : "prominent";

  return (
    <div
      className={`rounded-[10px] border border-border-card bg-bg-card px-3 py-2 text-text-dim ${
        compact ? "text-[10px]" : effectiveLogo === "prominent" ? "text-[12px]" : "text-[11px]"
      }`}
    >
      <div
        className={`mb-3 rounded-[8px] bg-white ${
          effectiveLogo === "prominent"
            ? "flex justify-center px-4 py-5 sm:px-6 sm:py-6"
            : "inline-block p-3"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NJMLS_IDX_LOGO_PATH}
          width={effectiveLogo === "prominent" ? 360 : 200}
          height={effectiveLogo === "prominent" ? 45 : 25}
          alt="New Jersey Multiple Listing Service"
          className={`h-auto max-w-full object-contain ${
            effectiveLogo === "prominent"
              ? "w-[min(100%,360px)] min-w-[220px]"
              : ""
          }`}
          style={
            effectiveLogo === "prominent"
              ? { width: "min(100%, 360px)", height: "auto" }
              : { width: 200, height: "auto" }
          }
        />
      </div>
      <p>{getIdxDisclaimerText()}</p>
      {!compact && includeAgentAttribution ? (
        <p className="mt-2 text-[11px] font-medium text-text-primary">
          {AGENT_NAME}, NJ License #{AGENT_LICENSE}
        </p>
      ) : null}
      {lastUpdated ? (
        <p className="mt-1">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      ) : null}
      {brokerageName ? <p className="mt-1">Listing brokerage: {brokerageName}</p> : null}
      <p className="mt-1">{EQUAL_HOUSING_DISCLOSURE}</p>
    </div>
  );
}
