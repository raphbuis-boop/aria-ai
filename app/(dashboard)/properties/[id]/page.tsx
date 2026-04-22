import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PropertyPageClient } from "./property-page-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PropertyByIdPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { return?: string };
}) {
  const id = decodeURIComponent(params.id);
  const returnTo =
    typeof searchParams.return === "string" ? searchParams.return : null;

  if (UUID_RE.test(id)) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: prop } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("agent_id", user.id)
      .maybeSingle();

    if (!prop) notFound();

    return (
      <PropertyPageClient
        mode="internal"
        internalProperty={prop as Record<string, unknown>}
        returnTo={returnTo}
      />
    );
  }

  return <PropertyPageClient mode="mls" mlsId={id} returnTo={returnTo} />;
}
