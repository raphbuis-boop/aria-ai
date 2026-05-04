import {
  EQUAL_HOUSING_DISCLOSURE,
  getIdxDisclaimerText,
  NJMLS_IDX_LOGO_PATH,
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={NJMLS_IDX_LOGO_PATH}
        alt="New Jersey Multiple Listing Service"
        className="h-10 w-auto mb-2"
      />
      <p>{getIdxDisclaimerText()}</p>
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
