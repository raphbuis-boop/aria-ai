import { createClient } from "@/lib/supabase/server";
import { PropertiesClient } from "./properties-client";

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: props } = await supabase
    .from("properties")
    .select("*")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  const available =
    props?.filter((p) => p.status === "available").length ?? 0;

  return (
    <PropertiesClient initial={props ?? []} availableCount={available} />
  );
}
