import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "client-documents";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — reasonable for most offers / inspection reports
const ALLOWED_CATEGORIES = new Set([
  "purchase_offer",
  "counter_offer",
  "inspection_report",
  "disclosure",
  "appraisal",
  "mortgage_docs",
  "closing_docs",
  "bba",
  "other",
]);

/**
 * Browsers let you upload almost anything; we keep the allow-list to common
 * real-estate document formats so the bucket doesn't fill up with random junk.
 */
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument",
  "text/plain",
];

function isAllowedMime(mime: string | null | undefined) {
  if (!mime) return true; // browser sometimes doesn't set it — let it through
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

type DocRow = {
  id: string;
  agent_id: string;
  client_id: string;
  category: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_at: string;
};

/**
 * GET /api/client-documents?clientId=X
 * Returns the authed agent's documents for a client, newest first, each with
 * a short-lived signed URL for inline preview / download.
 */
export async function GET(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("client_documents")
    .select(
      "id, agent_id, client_id, category, file_name, storage_path, file_size, mime_type, notes, uploaded_at",
    )
    .eq("agent_id", user.id)
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (rows ?? []) as DocRow[];

  // Sign URLs in parallel for fast list rendering.
  const signed = await Promise.all(
    list.map(async (row) => {
      const { data } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      return { ...row, signed_url: data?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ documents: signed });
}

/**
 * POST /api/client-documents
 * Multipart form upload.  Fields: clientId, category, file, notes?
 */
export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  }

  const clientId = String(form.get("clientId") ?? "").trim();
  const category = String(form.get("category") ?? "other").trim();
  const notes = String(form.get("notes") ?? "").trim() || null;
  const file = form.get("file");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` }, { status: 413 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const admin = createAdminClient();

  // Verify the client belongs to the authed agent before we write anything.
  const { data: client } = await admin
    .from("clients")
    .select("id, agent_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.agent_id !== user.id) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const key = `${user.id}/${clientId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("client_documents")
    .insert({
      agent_id: user.id,
      client_id: clientId,
      category,
      file_name: file.name,
      storage_path: key,
      file_size: file.size,
      mime_type: file.type || null,
      notes,
    })
    .select(
      "id, agent_id, client_id, category, file_name, storage_path, file_size, mime_type, notes, uploaded_at",
    )
    .single();

  if (error) {
    // Best-effort cleanup if the DB insert fails after upload.
    await admin.storage.from(BUCKET).remove([key]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60);

  // Log on the activity timeline so the agent has a breadcrumb.
  await admin.from("activities").insert({
    client_id: clientId,
    agent_id: user.id,
    type: "note",
    body: `Uploaded document: ${file.name} (${category.replace(/_/g, " ")}).`,
    ai_draft: false,
    approved: true,
    sent: false,
  });

  return NextResponse.json({
    document: { ...data, signed_url: signed?.signedUrl ?? null },
  });
}
