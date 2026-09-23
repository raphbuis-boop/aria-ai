import { PropertyPageClient } from "../../properties/[id]/property-page-client";

export default function ListingDetailPage({
  params,
  searchParams,
}: {
  params: { mlsId: string };
  searchParams: { return?: string };
}) {
  const returnTo = typeof searchParams.return === "string" ? searchParams.return : "/listings";
  return <PropertyPageClient mode="mls" mlsId={decodeURIComponent(params.mlsId)} returnTo={returnTo} />;
}
