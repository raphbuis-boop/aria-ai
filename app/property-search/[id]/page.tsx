import { PropertyPageClient } from "@/app/(dashboard)/properties/[id]/property-page-client";
import {
  AGENT_LICENSE,
  AGENT_NAME,
  BROKERAGE_LICENSE,
  BROKERAGE_NAME,
} from "@/lib/compliance";
import { notFound } from "next/navigation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PublicPropertyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { return?: string };
}) {
  const id = decodeURIComponent(params.id);
  if (UUID_RE.test(id)) notFound();

  const returnTo =
    typeof searchParams.return === "string" ? searchParams.return : null;

  return (
    <>
      <div className="border-b border-border-card bg-bg-card/90 px-4 py-3 text-center">
        <p className="text-[18px] font-semibold text-text-primary md:text-[22px]">
          {BROKERAGE_NAME}
        </p>
        <p className="mt-1 text-[11px] text-text-primary md:text-[12px]">
          {BROKERAGE_NAME}, License #{BROKERAGE_LICENSE} · {AGENT_NAME}, NJ License #
          {AGENT_LICENSE}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Listing details (technology partner: Aria)
        </p>
      </div>
      <PropertyPageClient
        mode="mls"
        mlsId={id}
        returnTo={returnTo}
        viewerContext="public"
      />
    </>
  );
}
