import { MlsSearchClient } from "@/app/(dashboard)/mls/mls-search-client";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getComplianceProfileServer();
  return {
    title: "Property Search",
    description: profile.brokerageName
      ? `Browse active listings from participating brokers (${profile.brokerageName}).`
      : "Browse active listings from participating brokers.",
  };
}

export default async function PropertySearchPage() {
  const profile = await getComplianceProfileServer();
  return (
    <>
      <div className="border-b border-border-card bg-bg-card/90 px-4 py-4 text-center">
        <p className="text-[22px] font-semibold leading-tight text-text-primary md:text-[26px]">
          {profile.brokerageName || "Property Search"}
        </p>
        <p className="mt-1 text-[13px] text-text-dim md:text-[14px]">
          Property Search · powered by Aria
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
      <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
        <IdxComplianceNotice logoSize="prominent" />
      </div>
    </>
  );
}
