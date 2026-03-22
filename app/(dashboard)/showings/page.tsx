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

  return <ShowingsClient initial={rows ?? []} />;
}
