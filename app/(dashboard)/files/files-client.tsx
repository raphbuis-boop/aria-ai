"use client";

import { FileRow } from "@/components/FileRow";
import { createClient } from "@/lib/supabase/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function FilesClient({
  groups,
}: {
  groups: { name: string; rows: Record<string, unknown>[] }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return groups;
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) =>
          String(r.name ?? "").toLowerCase().includes(q.toLowerCase()),
        ),
      }))
      .filter((g) => g.rows.length);
  }, [groups, q]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: first } = await supabase
      .from("clients")
      .select("id")
      .eq("agent_id", user.id)
      .limit(1)
      .maybeSingle();
    const clientId = first?.id;
    if (!clientId) {
      toast.toast("Create a client first", "warn");
      return;
    }
    const path = `${user.id}/${clientId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("files").upload(path, file);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    const { data: pub } = supabase.storage.from("files").getPublicUrl(path);
    await supabase.from("files").insert({
      client_id: clientId,
      agent_id: user.id,
      name: file.name,
      storage_path: path,
      public_url: pub.publicUrl,
      file_type: "other",
    });
    toast.toast("Uploaded", "success");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">Files</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        className="mt-4 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[13px]"
      />
      <label className="mt-3 inline-block rounded-[8px] bg-accent-blue px-4 py-2 text-[13px] font-medium text-white">
        Upload
        <input type="file" className="hidden" onChange={upload} />
      </label>
      <div className="mt-6 space-y-6">
        {filtered.map((g) => (
          <div key={g.name}>
            <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
              {g.name}
            </div>
            <div className="mt-2 space-y-2">
              {g.rows.map((r) => (
                <FileRow
                  key={String(r.id)}
                  name={r.name as string | null}
                  file_type={r.file_type as string | null}
                  created_at={String(r.created_at)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
