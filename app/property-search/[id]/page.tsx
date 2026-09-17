import { PropertyPageClient } from "@/app/(dashboard)/properties/[id]/property-page-client";
import { getComplianceProfileServer } from "@/lib/compliance";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicPropertyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { return?: string };
}) {
  let id = params.id;
  try {
    id = decodeURIComponent(params.id);
  } catch {
    /* use raw */
  }
  id = id.trim();
  if (UUID_RE.test(id)) notFound();

  const returnTo =
    typeof searchParams.return === "string" ? searchParams.return : null;
  const profile = await getComplianceProfileServer();

  return (
    <>
      <div className="border-b border-border-card bg-bg-card/90 px-4 py-3 text-center">
        <p className="text-[18px] font-semibold text-text-primary md:text-[22px]">
          {profile.brokerageName || "Property Search"}
        </p>
        <p className="mt-1 text-[13px] text-text-dim md:text-[14px]">
          Property Search · powered by Aria
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
