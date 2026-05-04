import { MlsSearchClient } from "@/app/(dashboard)/mls/mls-search-client";
import {
  AGENT_LICENSE,
  AGENT_NAME,
  BROKERAGE_LICENSE,
  BROKERAGE_NAME,
} from "@/lib/compliance";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Property Search",
  description: `Browse active listings from participating brokers (${BROKERAGE_NAME}).`,
};

export default function PropertySearchPage() {
  return (
    <>
      <div className="border-b border-border-card bg-bg-card/90 px-4 py-4 text-center">
        <p className="text-[22px] font-semibold leading-tight text-text-primary md:text-[26px]">
          {BROKERAGE_NAME}
        </p>
        <p className="mt-2 text-[12px] text-text-primary md:text-[13px]">
          {BROKERAGE_NAME}, License #{BROKERAGE_LICENSE} · {AGENT_NAME}, NJ License #
          {AGENT_LICENSE}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Property listing search (technology partner: Aria)
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-text-dim">
            Loading search…
          </div>
        }
      >
        <MlsSearchClient variant="public" />
      </Suspense>
    </>
  );
}
