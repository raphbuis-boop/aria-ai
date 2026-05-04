import { NextResponse } from "next/server";
import { allowMlsDiagnostics } from "@/lib/runtime-env";
import {
  describeSimplyRetsEnv,
  getSimplyRetsAuthHeader,
  isSimplyRetsConfigured,
  resolveSimplyRetsCredentials,
  SIMPLYRETS_API_BASE,
} from "@/lib/simplyrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Debug endpoint for SimplyRETS integration. Unauthenticated; disabled in
 * production unless ENABLE_MLS_DIAGNOSTICS=true. Previews only —
 * not full credential values.
 */
export async function GET() {
  if (!allowMlsDiagnostics()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const env = describeSimplyRetsEnv();

  if (!isSimplyRetsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "No SimplyRETS credential pair detected. Expected one of: (SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_PASSWORD), (SIMPLYRETS_USERNAME + SIMPLYRETS_PASSWORD), (SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_KEY), (SIMPLYRETS_API_USERNAME + SIMPLYRETS_API_SECRET), or (SIMPLYRETS_API_KEY + SIMPLYRETS_API_SECRET).",
        env,
      },
      { status: 503 },
    );
  }

  const base =
    process.env.SIMPLYRETS_API_URL?.trim().replace(/\/$/, "") ??
    SIMPLYRETS_API_BASE;
  const endpoint = `${base}/properties?limit=1`;

  const startedAt = Date.now();
  let upstreamStatus: number | null = null;
  const upstreamHeaders: Record<string, string> = {};
  let upstreamBodyPreview: string | null = null;
  let upstreamBodyParsed: unknown = null;
  let fetchError: string | null = null;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: getSimplyRetsAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    upstreamStatus = response.status;
    response.headers.forEach((value, key) => {
      upstreamHeaders[key] = value;
    });

    const text = await response.text();
    upstreamBodyPreview = text.slice(0, 2000);
    try {
      upstreamBodyParsed = JSON.parse(text);
    } catch {
      // Non-JSON body — leave parsed as null, preview is still available.
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const elapsedMs = Date.now() - startedAt;
  const ok = upstreamStatus !== null && upstreamStatus >= 200 && upstreamStatus < 300;

  return NextResponse.json(
    {
      ok,
      env,
      request: {
        endpoint,
        method: "GET",
        credentialSource: resolveSimplyRetsCredentials()?.source ?? null,
      },
      response: {
        status: upstreamStatus,
        headers: upstreamHeaders,
        bodyPreview: upstreamBodyPreview,
        bodyParsed: upstreamBodyParsed,
      },
      fetchError,
      elapsedMs,
    },
    { status: ok ? 200 : 502 },
  );
}
