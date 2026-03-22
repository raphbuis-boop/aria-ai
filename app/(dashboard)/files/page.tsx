import { createClient } from "@/lib/supabase/server";
import { FilesClient } from "./files-client";

export default async function FilesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: files } = await supabase
    .from("files")
    .select("*, clients(name)")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  const grouped: Record<
    string,
    { name: string; rows: NonNullable<typeof files> }
  > = {};
  for (const f of files ?? []) {
    const cname = (f.clients as { name?: string } | null)?.name ?? "Unknown client";
    let bucket = grouped[cname];
    if (!bucket) {
      bucket = { name: cname, rows: [] };
      grouped[cname] = bucket;
    }
    bucket.rows.push(f);
  }

  return <FilesClient groups={Object.values(grouped)} />;
}
