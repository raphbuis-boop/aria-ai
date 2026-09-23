import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARIA_RECOMMENDED_REASON, AGENT_SENT_REASON } from "@/lib/sms/recommend-reasons";
import { ARIA_TASK_KINDS } from "@/lib/sms/tasks";
import { ClientDetail, type MatchedHome, type ShowingItem } from "./client-detail";

export const dynamic = "force-dynamic";

type Rel<T> = T | T[] | null;
type PropertyJoin = {
  id: string;
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  town: string | null;
  status: string | null;
  photos: unknown;
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .eq("agent_id", user.id) // multi-tenant safety
    .maybeSingle();
  if (!client) notFound();

  const [{ data: activities }, { data: matchRows }, { data: showings }, { data: bba }, { data: ariaTasks }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id, type, direction, body, ai_draft, approved, sent, created_at, metadata")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("property_matches")
        .select("match_score, match_reasons, created_at, properties(id, address, price, beds, baths, town, status, photos)")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .order("match_score", { ascending: false })
        .limit(12),
      supabase
        .from("showings")
        .select("id, address, showing_date, status, requested_time_text, notes, created_at")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("buyer_broker_agreements")
        .select("commission_pct, signed_at, term_start, term_end, search_area, signed_storage_path")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, kind, title, client_id, created_at")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .eq("done", false)
        .in("kind", ARIA_TASK_KINDS.filter((k) => k !== "aria_showing_approval"))
        .order("created_at", { ascending: true }),
    ]);

  // Short-lived link to the signed PDF (private bucket; ownership checked above).
  let signedPdfUrl: string | null = null;
  if (bba?.signed_storage_path) {
    const { data: signed } = await createAdminClient()
      .storage.from("bba-templates")
      .createSignedUrl(bba.signed_storage_path as string, 60 * 60);
    signedPdfUrl = signed?.signedUrl ?? null;
  }

  const homes: MatchedHome[] = (matchRows ?? [])
    .map((row) => {
      const joined = row.properties as unknown as Rel<PropertyJoin>;
      const p = Array.isArray(joined) ? joined[0] : joined;
      if (!p) return null;
      const reasons = Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [];
      return {
        id: p.id,
        address: p.address,
        price: p.price,
        beds: p.beds,
        baths: p.baths,
        town: p.town,
        status: p.status,
        photo: Array.isArray(p.photos) && typeof p.photos[0] === "string" ? (p.photos[0] as string) : null,
        score: Number(row.match_score ?? 0),
        sent: reasons.includes(ARIA_RECOMMENDED_REASON) ? ("aria" as const) : reasons.includes(AGENT_SENT_REASON) ? ("agent" as const) : null,
      };
    })
    .filter((h): h is MatchedHome => h !== null)
    // Homes already texted first, then best fit.
    .sort((a, b) => Number(Boolean(b.sent)) - Number(Boolean(a.sent)) || b.score - a.score);

  const allActivities = activities ?? [];

  return (
    <ClientDetail
      client={client}
      activities={allActivities}
      homes={homes}
      showings={(showings ?? []) as ShowingItem[]}
      ariaTasks={(ariaTasks ?? []).map((t) => ({
        id: String(t.id),
        kind: String(t.kind),
        title: t.title as string,
        clientId: params.id,
        clientName: null,
        createdAt: t.created_at as string,
      }))}
      ariaThread={{
        phone: (client.phone as string | null) ?? null,
        paused: Boolean(client.aria_paused),
        optedOut: Boolean(client.sms_opted_out),
        started: allActivities.some((a) => a.type === "text"),
      }}
      bba={
        bba?.signed_at
          ? {
              signed_at: bba.signed_at as string,
              commission_pct: Number(bba.commission_pct),
              term_start: bba.term_start as string,
              term_end: bba.term_end as string,
              search_area: (bba.search_area as string | null) ?? null,
              signed_pdf_url: signedPdfUrl,
            }
          : null
      }
    />
  );
}
