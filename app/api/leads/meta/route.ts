import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead } from "@/lib/sms/lead";
import { parseMetaLead } from "@/lib/sms/lead-sources";
import { defaultLeadAgentId, metaSignatureMatches } from "@/lib/sms/lead-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v25.0"}`;

/** Meta webhook subscription handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.META_VERIFY_TOKEN;
  if (
    token &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === token
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Meta Lead Ads `leadgen` webhook. The payload only carries ids; the form
 * answers are fetched from the Graph API with the Page access token, then
 * the lead goes through the same ingestLead path as every other source.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!metaSignatureMatches(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(raw || "{}") as {
    entry?: Array<{ changes?: Array<{ field?: string; value?: { leadgen_id?: string } }> }>;
  };
  const leadgenIds = (payload.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .filter((c) => c.field === "leadgen" && c.value?.leadgen_id)
    .map((c) => c.value!.leadgen_id!);

  const agentId = process.env.META_LEAD_AGENT_ID?.trim() || defaultLeadAgentId();
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!agentId || !pageToken) {
    console.error("[leads/meta] set META_PAGE_ACCESS_TOKEN and META_LEAD_AGENT_ID/LEAD_DEFAULT_AGENT_ID");
    // 200 so Meta doesn't disable the subscription while it's being configured.
    return Response.json({ ok: false, configured: false });
  }

  waitUntil(
    Promise.all(
      leadgenIds.map(async (id) => {
        try {
          const res = await fetch(
            `${GRAPH}/${encodeURIComponent(id)}?fields=id,field_data,created_time&access_token=${encodeURIComponent(pageToken)}`,
          );
          if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
          const lead = parseMetaLead(await res.json());
          await ingestLead(createAdminClient(), { agentId, source: "meta", ...lead });
        } catch (error) {
          console.error("[leads/meta] lead", id, "failed", error);
        }
      }),
    ),
  );

  return Response.json({ ok: true, received: leadgenIds.length });
}
