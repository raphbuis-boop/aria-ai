import { singleListingResponse } from "@/lib/mls-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type { MlsListingPayload } from "@/lib/simplyrets";

/** Public (IDX detail pages): one MLS listing. No feed → `{ connected: false, listing: null }`. */
export async function GET(
  _req: Request,
  { params }: { params: { mlsId: string } },
) {
  return singleListingResponse(params.mlsId, "api/properties");
}
