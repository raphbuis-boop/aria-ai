import { NextResponse } from "next/server";
import { fetchSimplyRetsSingleProperty } from "@/lib/simplyrets";

/**
 * Every /api route that calls SimplyRETS answers the same way when there's no
 * working MLS feed: HTTP 200 with `connected: false`, a reason, and the same
 * empty shape a successful response would have — never a 502/503. UIs check
 * `connected === false` and show their "MLS isn't connected" state.
 *
 *   not_configured — no SimplyRETS credentials set
 *   unavailable    — credentials set, but SimplyRETS rejected or didn't answer
 */
export type MlsNotConnectedReason = "not_configured" | "unavailable";

const MESSAGES: Record<MlsNotConnectedReason, string> = {
  not_configured: "The MLS feed isn't connected.",
  unavailable: "The MLS feed isn't responding right now.",
};

export function mlsNotConnected<T extends Record<string, unknown>>(reason: MlsNotConnectedReason, empty: T) {
  return NextResponse.json({ connected: false as const, reason, message: MESSAGES[reason], ...empty });
}

/**
 * One MLS listing by id, for the listing detail routes:
 *   200 { connected: true, listing } · 404 LISTING_GONE · 200 { connected: false, listing: null }
 */
export async function singleListingResponse(mlsId: string | undefined, tag: string) {
  const id = mlsId?.trim();
  if (!id) return NextResponse.json({ error: "mlsId required" }, { status: 400 });

  const result = await fetchSimplyRetsSingleProperty(id);
  if (result.ok) return NextResponse.json({ connected: true, listing: result.listing });

  const { failure } = result;
  if (failure.kind === "not_configured") return mlsNotConnected("not_configured", { listing: null });
  if (failure.kind === "upstream" && failure.status === 404) {
    return NextResponse.json({ error: "Listing no longer available", code: "LISTING_GONE" }, { status: 404 });
  }
  console.error(`[${tag}] SimplyRETS failed`, {
    mlsId: id,
    endpoint: failure.endpoint,
    ...(failure.kind === "network" ? { message: failure.message } : { status: failure.status, body: failure.bodyPreview }),
  });
  return mlsNotConnected("unavailable", { listing: null });
}
