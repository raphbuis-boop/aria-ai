import { createClient } from "@/lib/supabase/server";
import { fetchSimplyRetsSingleProperty } from "@/lib/simplyrets";
import { notFound } from "next/navigation";
import { ListingRevenueClient } from "./ListingRevenueClient";

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: { mlsId: string };
  searchParams: { return?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const mlsId = decodeURIComponent(params.mlsId);
  const returnTo =
    typeof searchParams.return === "string" ? searchParams.return : "/listings";

  const result = await fetchSimplyRetsSingleProperty(mlsId);
  if (!result.ok) notFound();

  return <ListingRevenueClient listing={result.listing} returnTo={returnTo} />;
}
