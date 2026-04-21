import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "client-documents";

/**
 * DELETE /api/client-documents/[id]
 * Removes the DB row and the corresponding storage object. Agent-scoped.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("client_documents")
    .select("id, agent_id, storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!doc || doc.agent_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("client_documents")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Best-effort storage cleanup; don't fail the request if the object is gone.
  if (doc.storage_path) {
    await admin.storage.from(BUCKET).remove([doc.storage_path]);
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/client-documents/[id]
 * Returns a fresh signed URL for downloading / previewing a document.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("client_documents")
    .select("id, agent_id, storage_path, file_name, mime_type")
    .eq("id", params.id)
    .maybeSingle();

  if (!doc || doc.agent_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 60);

  return NextResponse.json({
    signed_url: data?.signedUrl ?? null,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
  });
}
