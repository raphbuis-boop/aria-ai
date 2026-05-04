import {
  AGENT_LICENSE,
  AGENT_NAME,
  EQUAL_HOUSING_DISCLOSURE,
  getIdxDisclaimerText,
} from "@/lib/compliance";

export function IdxComplianceNotice({
  lastUpdated,
  brokerageName,
  compact = false,
}: {
  lastUpdated?: string | null;
  brokerageName?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border border-border-card bg-bg-card px-3 py-2 text-text-dim ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <div className="mb-3 inline-block rounded-[8px] bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/IDX_logo.JPG"
          width={200}
          alt="New Jersey Multiple Listing Service"
          className="h-auto max-w-full object-contain"
          style={{ width: 200, height: "auto" }}
        />
      </div>
      <p>{getIdxDisclaimerText()}</p>
      {!compact ? (
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
