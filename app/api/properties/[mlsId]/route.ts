import { NextResponse } from "next/server";
import {
  fetchSimplyRetsSingleProperty,
  isSimplyRetsConfigured,
  resolveSimplyRetsCredentials,
} from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type { MlsListingPayload } from "@/lib/simplyrets";

export async function GET(
  _req: Request,
  { params }: { params: { mlsId: string } },
) {
  const mlsId = params.mlsId?.trim();
  if (!mlsId) {
    return NextResponse.json({ error: "mlsId required" }, { status: 400 });
  }

  if (!isSimplyRetsConfigured()) {
    console.error("[api/properties] SimplyRETS not configured", { mlsId });
    return NextResponse.json(
      { error: "Listing service is not configured." },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[api/properties] fetching listing", {
      mlsId,
      credentialSource: resolveSimplyRetsCredentials()?.source,
    });
  }

  const result = await fetchSimplyRetsSingleProperty(mlsId);

  if (!result.ok) {
    const { failure } = result;
    if (failure.kind === "not_configured") {
      return NextResponse.json(
        { error: "SimplyRETS is not configured." },
        { status: 503 },
      );
    }
    if (failure.kind === "network") {
      console.error("[api/properties] network error", {
        mlsId,
        endpoint: failure.endpoint,
        message: failure.message,
      });
      return NextResponse.json(
        {
          error:
            "Could not reach the listing service. Check your connection and try again.",
        },
        { status: 502 },
      );
    }
    if (failure.status === 404) {
      console.warn("[api/properties] SimplyRETS 404", {
        mlsId,
        endpoint: failure.endpoint,
      });
      return NextResponse.json(
        {
          error: "Listing no longer available",
          code: "LISTING_GONE",
        },
        { status: 404 },
      );
    }

    console.error("[api/properties] SimplyRETS error", {
      mlsId,
      endpoint: failure.endpoint,
      status: failure.status,
      bodyPreview: failure.bodyPreview,
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

  if (process.env.NODE_ENV !== "production") {
    console.log("[api/properties] ok", {
      mlsId,
      mlsNumber: result.listing.mlsNumber,
    });
  }

  return NextResponse.json({
    listing: result.listing,
  });
}
