import { MlsSearchClient } from "@/app/(dashboard)/listings/mls-search-client";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { BROKERAGE_NAME } from "@/lib/compliance";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Property Search",
  description: `Browse active listings from participating brokers (${BROKERAGE_NAME}).`,
};

export default function PropertySearchPage() {
  return (
    <>
      <div className="border-b border-border bg-card/90 px-4 py-4 text-center">
        <p className="text-[22px] font-semibold leading-tight text-foreground md:text-[26px]">
          {BROKERAGE_NAME}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground md:text-[14px]">
          Property Search · powered by Aria
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-muted-foreground">
            Loading search…
          </div>
        }
      >
        <MlsSearchClient variant="public" />
      </Suspense>
      <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
        <IdxComplianceNotice logoSize="prominent" />
      </div>
    </>
  );
}
