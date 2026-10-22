import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { singleListingResponse } from "@/lib/mls-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type { MlsListingPayload } from "@/lib/simplyrets";

/** @deprecated Prefer GET /api/properties/[mlsId] for listing detail (same behavior). */
export async function GET(_req: Request, props: { params: Promise<{ mlsId: string }> }) {
  const params = await props.params;
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return singleListingResponse(params.mlsId, "mls/property");
}
