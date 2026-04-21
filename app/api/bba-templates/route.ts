import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBrokerage } from "@/lib/brokerages";

export const dynamic = "force-dynamic";

const BUCKET = "bba-templates";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB hard cap for brokerage PDFs

type TemplateRow = {
  id: string;
  brokerage_id: string;
  agent_id: string;
  template_name: string;
  file_url: string | null;
  storage_path: string;
  is_default: boolean;
  uploaded_at: string;
};

/**
 * GET /api/bba-templates
 * Returns the list of templates for the current agent's brokerage, each
 * with a short-lived signed URL for preview/download.
 */
export async function GET() {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const brokerageId = await ensureBrokerage(admin, user.id);

  const { data, error } = await admin
    .from("brokerage_bba_templates")
    .select(
      "id, brokerage_id, agent_id, template_name, file_url, storage_path, is_default, uploaded_at",
    )
    .eq("brokerage_id", brokerageId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const templates = await Promise.all(
    ((data ?? []) as TemplateRow[]).map(async (row) => {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ templates, brokerage_id: brokerageId });
}

/**
 * POST /api/bba-templates
 * Multipart form upload: { file: File, template_name?: string, is_default?: "1" }.
 * Uploads to the private `bba-templates` bucket at {brokerage_id}/{template_id}.pdf
 * and inserts a row.
 */
export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "multipart/form-data required" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const rawName =
    (form.get("template_name") as string | null)?.toString().trim() ||
    ((file as unknown as { name?: string }).name ?? "Template").replace(
      /\.pdf$/i,
      "",
    );
  const templateName = rawName.slice(0, 120);
  const wantDefault = form.get("is_default") === "1";

  const admin = createAdminClient();
  const brokerageId = await ensureBrokerage(admin, user.id);

  // Reserve an ID so we can name the storage file deterministically.
  const id = crypto.randomUUID();
  const storagePath = `${brokerageId}/${id}.pdf`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadErr.message}` },
      { status: 400 },
    );
  }

  // If the caller asked for default OR the brokerage has no default yet,
  // this upload becomes the default.
  let isDefault = wantDefault;
  if (!wantDefault) {
    const { count } = await admin
      .from("brokerage_bba_templates")
      .select("id", { count: "exact", head: true })
      .eq("brokerage_id", brokerageId)
      .eq("is_default", true);
    if (!count) isDefault = true;
  }

  if (isDefault) {
    // Unset any existing defaults first so is_default is effectively unique.
    await admin
      .from("brokerage_bba_templates")
      .update({ is_default: false })
      .eq("brokerage_id", brokerageId)
      .eq("is_default", true);
  }

  const { data: inserted, error: insertErr } = await admin
    .from("brokerage_bba_templates")
    .insert({
      id,
      brokerage_id: brokerageId,
      agent_id: user.id,
      template_name: templateName,
      storage_path: storagePath,
      is_default: isDefault,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    // Clean up the orphaned file.
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not save template" },
      { status: 400 },
    );
  }

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({
    template: { ...inserted, signed_url: signed?.signedUrl ?? null },
  });
}
