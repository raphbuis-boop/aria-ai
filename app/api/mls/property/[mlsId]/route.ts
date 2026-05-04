import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  fetchSimplyRetsSingleProperty,
  isSimplyRetsConfigured,
  resolveSimplyRetsCredentials,
} from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type { MlsListingPayload } from "@/lib/simplyrets";

/** @deprecated Prefer GET /api/properties/[mlsId] for listing detail (same behavior). */
export async function GET(
  _req: Request,
  { params }: { params: { mlsId: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mlsId = params.mlsId?.trim();
  if (!mlsId) {
    return NextResponse.json({ error: "mlsId required" }, { status: 400 });
  }

  if (!isSimplyRetsConfigured()) {
    return NextResponse.json(
      { error: "Listing service is not configured." },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[mls/property] fetching listing", {
      mlsId,
      credentialSource: resolveSimplyRetsCredentials()?.source,
    });
  }

  const result = await fetchSimplyRetsSingleProperty(mlsId);

  if (!result.ok) {
    const { failure } = result;
    if (failure.kind === "not_configured") {
      return NextResponse.json(
        { error: "Listing service is not configured." },
        { status: 503 },
      );
    }
    if (failure.kind === "network") {
      console.error("[mls/property] fetch threw", {
        endpoint: failure.endpoint,
        message: failure.message,
      });
      return NextResponse.json(
        {
          error:
            "Could not reach the listing service. Try again in a moment.",
        },
        { status: 502 },
      );
    }
    if (failure.status === 404) {
      return NextResponse.json(
        {
          error: "Listing no longer available",
          code: "LISTING_GONE",
        },
        { status: 404 },
      );
    }
    console.error("[mls/property] SimplyRETS non-2xx", {
      endpoint: failure.endpoint,
      status: failure.status,
      body: failure.bodyPreview,
    });
    return NextResponse.json(
      {
        error:
          "Unable to load this listing right now. Please try again in a moment.",
        code: "UPSTREAM_ERROR",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ listing: result.listing });
}
