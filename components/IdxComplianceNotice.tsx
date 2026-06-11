"use client";

import { useState } from "react";
// TODO(Phase 2): accept an agentProfile prop and call getIdxDisclaimerForAgent()
//   instead of getIdxDisclaimerText() so per-agent brokerage branding is shown
//   on each agent's shareable public link.
import { getIdxDisclaimerText, AGENT_NAME, AGENT_LICENSE, EQUAL_HOUSING_DISCLOSURE } from "@/lib/compliance";

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
          <p>{getIdxDisclaimerText()}</p>
          {brokerageName && <p>Listing brokerage: {brokerageName}</p>}
          {includeAgentAttribution && (
            <p>{AGENT_NAME}, NJ License #{AGENT_LICENSE}</p>
          )}
          <p>{EQUAL_HOUSING_DISCLOSURE}</p>
        </div>
      )}
    </div>
  );
}
