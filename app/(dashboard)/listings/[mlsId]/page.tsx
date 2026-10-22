import { PropertyPageClient } from "../../properties/[id]/property-page-client";

export default async function ListingDetailPage(
  props: {
    params: Promise<{ mlsId: string }>;
    searchParams: Promise<{ return?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const returnTo = typeof searchParams.return === "string" ? searchParams.return : "/listings";
  return <PropertyPageClient mode="mls" mlsId={decodeURIComponent(params.mlsId)} returnTo={returnTo} />;
}
