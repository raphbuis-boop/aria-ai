"use client";

import { useEffect, useState } from "react";
import { EQUAL_HOUSING_DISCLOSURE, getIdxDisclaimerText, type ComplianceProfile } from "@/lib/compliance";

export function IdxComplianceNotice({
  brokerageName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logoSize = "default",
  includeAgentAttribution = false,
}: {
  brokerageName?: string | null;
  compact?: boolean;
  logoSize?: "default" | "prominent";
  includeAgentAttribution?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);

  useEffect(() => {
    void fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => {});
  }, []);

  const effectiveBrokerageName = brokerageName ?? profile?.brokerageName ?? null;

  return (
    <div className="border-t border-[#1e2230] pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/IDX_logo.JPG"
          width={64}
          height={8}
          alt="NJMLS IDX"
          className="h-auto w-16 flex-shrink-0 rounded-[3px] bg-white px-1.5 py-1 object-contain"
        />
        <span className="flex-1 text-[10px] text-[#424560]">
          NJMLS IDX · Equal Housing Opportunity
        </span>
        <span className="text-[11px] text-[#424560]">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-[#424560]">
          <p>{getIdxDisclaimerText(effectiveBrokerageName)}</p>
          {effectiveBrokerageName && <p>Listing brokerage: {effectiveBrokerageName}</p>}
          {includeAgentAttribution && profile?.legalName && profile?.licenseNumber && (
            <p>
              {profile.legalName}, {profile.licenseState ?? "NJ"} License #{profile.licenseNumber}
            </p>
          )}
          <p>{profile?.fairHousingStatement || EQUAL_HOUSING_DISCLOSURE}</p>
        </div>
      )}
    </div>
  );
}
