import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import {
  describeSimplyRetsEnv,
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  mapSimplyRetsListing,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";
import type { MlsListingPayload } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      {
        error: "SimplyRETS is not configured.",
        env: describeSimplyRetsEnv(),
      },
      { status: 503 },
    );
  }

  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
    SIMPLYRETS_API_BASE;
  const endpoint = `${base}/properties/${encodeURIComponent(mlsId)}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Authorization: getSimplyRetsAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mls/property] fetch threw", { endpoint, message });
    return NextResponse.json(
      { error: `Network error calling SimplyRETS: ${message}`, endpoint },
      { status: 502 },
    );
  }

  if (response.status === 404) {
    return NextResponse.json(
      { error: "Listing not found", endpoint },
      { status: 404 },
    );
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[mls/property] SimplyRETS non-2xx", {
      endpoint,
      status: response.status,
      body: text.slice(0, 500),
    });
    return NextResponse.json(
      {
        error:
          text?.slice(0, 500) || `SimplyRETS error (${response.status})`,
        endpoint,
        status: response.status,
      },
      { status: 502 },
    );
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const listing: MlsListingPayload = mapSimplyRetsListing(raw);

  return NextResponse.json({ listing, raw });
}
