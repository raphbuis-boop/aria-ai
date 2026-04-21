import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBrokerage } from "@/lib/brokerages";

export const dynamic = "force-dynamic";

const BUCKET = "bba-templates";

async function loadTemplateForAgent(id: string, userId: string) {
  const admin = createAdminClient();
  const brokerageId = await ensureBrokerage(admin, userId);
  const { data } = await admin
    .from("brokerage_bba_templates")
    .select("*")
    .eq("id", id)
    .eq("brokerage_id", brokerageId)
    .maybeSingle();
  return { admin, brokerageId, template: data };
}

/**
 * PATCH /api/bba-templates/:id
 * Body: { template_name?: string, is_default?: boolean, replace_with_storage_path?: string }
 * Renames or sets as default. (Replace-file is handled by deleting + re-uploading.)
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { admin, brokerageId, template } = await loadTemplateForAgent(
    params.id,
    user.id,
  );

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.template_name === "string" && body.template_name.trim()) {
    updates.template_name = body.template_name.trim().slice(0, 120);
  }
  if (typeof body.is_default === "boolean") {
    if (body.is_default) {
      await admin
        .from("brokerage_bba_templates")
        .update({ is_default: false })
        .eq("brokerage_id", brokerageId)
        .eq("is_default", true);
    }
    updates.is_default = body.is_default;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ template });
  }

  const { data, error } = await admin
    .from("brokerage_bba_templates")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ template: data });
}

/**
 * DELETE /api/bba-templates/:id
 * Removes the DB row + the underlying storage object.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { admin, template } = await loadTemplateForAgent(params.id, user.id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await admin.storage.from(BUCKET).remove([template.storage_path as string]);

  const { error } = await admin
    .from("brokerage_bba_templates")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
