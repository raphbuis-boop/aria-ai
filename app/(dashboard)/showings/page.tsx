import { createClient } from "@/lib/supabase/server";
import { ShowingsClient } from "./showings-client";

export default async function ShowingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("showings")
    .select("*, clients(name)")
    .eq("agent_id", user.id)
    .order("showing_date", { ascending: false });

  const { data: bbaRows } = await supabase
    .from("buyer_broker_agreements")
    .select("client_id")
    .eq("agent_id", user.id);

  const signedClientIds = new Set(
    (bbaRows ?? []).map((r) => String(r.client_id)),
  );

  return (
    <ShowingsClient
      initial={rows ?? []}
      signedClientIds={Array.from(signedClientIds)}
    />
  );
}
