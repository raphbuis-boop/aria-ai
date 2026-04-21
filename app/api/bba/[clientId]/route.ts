import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdf-lib needs Node runtime

const BUCKET = "bba-templates";

type BbaTemplateRow = {
  id: string;
  brokerage_id: string;
  storage_path: string;
  template_name: string;
  is_default: boolean;
};

/**
 * GET /api/bba/[clientId]
 * Returns the client, agent, any existing signed BBA, and short-lived signed
 * URLs for (a) the agent's chosen or default BBA template, and (b) the signed
 * copy if it exists. Public (no auth) so the /bba/sign/[id] page can render
 * for an unauthenticated buyer.
 */
export async function GET(
  req: Request,
  { params }: { params: { clientId: string } },
) {
  const url = new URL(req.url);
  const templateParam = url.searchParams.get("template");

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, name, agent_id")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: agentProfile } = await admin
    .from("agent_profiles")
    .select("full_name, brokerage_id")
    .eq("id", client.agent_id)
    .maybeSingle();

  const { data: bba } = await admin
    .from("buyer_broker_agreements")
    .select(
      "id, signed_at, commission_pct, term_start, term_end, search_area, client_name, agent_name, template_id, signed_storage_path",
    )
    .eq("client_id", params.clientId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve the template: explicit ?template= param wins; else agent's default
  // for their brokerage; else null (client will fall back to inline summary).
  let template: BbaTemplateRow | null = null;
  if (agentProfile?.brokerage_id) {
    if (templateParam) {
      const { data } = await admin
        .from("brokerage_bba_templates")
        .select("id, brokerage_id, storage_path, template_name, is_default")
        .eq("id", templateParam)
        .eq("brokerage_id", agentProfile.brokerage_id)
        .maybeSingle();
      template = (data as BbaTemplateRow | null) ?? null;
    }
    if (!template) {
      const { data } = await admin
        .from("brokerage_bba_templates")
        .select("id, brokerage_id, storage_path, template_name, is_default")
        .eq("brokerage_id", agentProfile.brokerage_id)
        .eq("is_default", true)
        .maybeSingle();
      template = (data as BbaTemplateRow | null) ?? null;
    }
  }

  let templateUrl: string | null = null;
  if (template) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(template.storage_path, 60 * 60);
    templateUrl = signed?.signedUrl ?? null;
  }

  let signedPdfUrl: string | null = null;
  if (bba?.signed_storage_path) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(bba.signed_storage_path as string, 60 * 60);
    signedPdfUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    agent: { name: agentProfile?.full_name ?? "Your Aria agent" },
    bba: bba ?? null,
    signed_pdf_url: signedPdfUrl,
    template: template
      ? {
          id: template.id,
          name: template.template_name,
          is_default: template.is_default,
          url: templateUrl,
        }
      : null,
  });
}

/**
 * Embed a signature PNG (base64 data URL) into the last page of a PDF at a
 * fixed bottom-right position. Returns the re-serialized PDF bytes.
 */
async function embedSignatureInPdf(
  pdfBytes: Uint8Array,
  signatureDataUrl: string,
  signatory: { clientName: string; signedAt: Date; commissionPct: number; termStart: string; termEnd: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const pages = pdf.getPages();
  if (!pages.length) return pdfBytes;
  const page = pages[pages.length - 1];

  const pngBase64 = signatureDataUrl.split(",").pop() ?? "";
  const pngBytes = Buffer.from(pngBase64, "base64");
  const png = await pdf.embedPng(pngBytes);

  const { width } = page.getSize();
  const sigWidth = Math.min(240, width * 0.4);
  const sigHeight = sigWidth * (png.height / png.width);
  const margin = 36;
  const x = width - sigWidth - margin;
  const y = margin + 24; // leave room for caption below

  page.drawImage(png, { x, y: y + 4, width: sigWidth, height: sigHeight });

  // Caption under the signature
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const caption = `${signatory.clientName} — signed ${signatory.signedAt.toISOString().slice(0, 10)}`;
  const terms = `${signatory.commissionPct}% · ${signatory.termStart} → ${signatory.termEnd}`;
  page.drawText(caption, {
    x,
    y: y - 6,
    size: 9,
    font,
    color: rgb(0.15, 0.15, 0.2),
  });
  page.drawText(terms, {
    x,
    y: y - 18,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.45),
  });

  return await pdf.save();
}

/**
 * POST /api/bba/[clientId]
 * Accepts:
 *   clientName, agentName, commissionPct, termStart, termEnd, searchArea,
 *   signatureData (base64 PNG data URL), templateId?
 *
 * If a templateId is provided (or the agent has a default template), the
 * signature is embedded into the template PDF via pdf-lib, and the signed
 * copy is uploaded to {bucket}/{brokerage_id}/signed/{bba_id}.pdf.
 *
 * Public (no session auth) because buyers sign from an unauthenticated link.
 * agent_id is derived from the client record so callers can't spoof ownership.
 */
export async function POST(
  req: Request,
  { params }: { params: { clientId: string } },
) {
  const body = await req.json().catch(() => ({}));

  const clientName = String(body.clientName ?? "").trim();
  const agentName = String(body.agentName ?? "").trim();
  const commissionPct = Number(body.commissionPct ?? 2.5);
  const termStart = String(body.termStart ?? "").trim();
  const termEnd = String(body.termEnd ?? "").trim();
  const searchArea = String(body.searchArea ?? "").trim() || null;
  const signatureData = String(body.signatureData ?? "");
  const templateIdInput = body.templateId ? String(body.templateId) : null;

  if (!clientName || !agentName || !termStart || !termEnd || !signatureData) {
    return NextResponse.json(
      {
        error:
          "clientName, agentName, termStart, termEnd, signatureData required",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, agent_id")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Resolve chosen template (explicit id > agent's default > none).
  const { data: agentProfile } = await admin
    .from("agent_profiles")
    .select("brokerage_id")
    .eq("id", client.agent_id)
    .maybeSingle();

  let template: BbaTemplateRow | null = null;
  if (agentProfile?.brokerage_id) {
    if (templateIdInput) {
      const { data } = await admin
        .from("brokerage_bba_templates")
        .select("id, brokerage_id, storage_path, template_name, is_default")
        .eq("id", templateIdInput)
        .eq("brokerage_id", agentProfile.brokerage_id)
        .maybeSingle();
      template = (data as BbaTemplateRow | null) ?? null;
    }
    if (!template) {
      const { data } = await admin
        .from("brokerage_bba_templates")
        .select("id, brokerage_id, storage_path, template_name, is_default")
        .eq("brokerage_id", agentProfile.brokerage_id)
        .eq("is_default", true)
        .maybeSingle();
      template = (data as BbaTemplateRow | null) ?? null;
    }
  }

  // Reserve a BBA id up front so the signed PDF path is deterministic.
  const reservedBbaId =
    (await admin
      .from("buyer_broker_agreements")
      .select("id")
      .eq("client_id", client.id)
      .maybeSingle()).data?.id ?? crypto.randomUUID();

  let signedStoragePath: string | null = null;
  let signedFileUrl: string | null = null;

  if (template) {
    try {
      const { data: fileBlob, error: dlErr } = await admin.storage
        .from(BUCKET)
        .download(template.storage_path);
      if (dlErr || !fileBlob) {
        throw new Error(dlErr?.message ?? "template download failed");
      }
      const tplBytes = new Uint8Array(await fileBlob.arrayBuffer());
      const signedBytes = await embedSignatureInPdf(tplBytes, signatureData, {
        clientName,
        signedAt: new Date(),
        commissionPct,
        termStart,
        termEnd,
      });

      signedStoragePath = `${template.brokerage_id}/signed/${reservedBbaId}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(signedStoragePath, Buffer.from(signedBytes), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw new Error(upErr.message);

      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(signedStoragePath, 60 * 60 * 24 * 7); // 7-day link
      signedFileUrl = signed?.signedUrl ?? null;
    } catch (err) {
      // PDF step failed — fall through to text-only agreement so we still
      // capture the signature. Surface the error in server logs.
      console.error("[bba/sign] pdf embed failed:", err);
      signedStoragePath = null;
      signedFileUrl = null;
    }
  }

  const { data, error } = await admin
    .from("buyer_broker_agreements")
    .upsert(
      {
        id: reservedBbaId,
        client_id: client.id,
        agent_id: client.agent_id,
        agent_name: agentName,
        client_name: clientName,
        commission_pct: commissionPct,
        term_start: termStart,
        term_end: termEnd,
        search_area: searchArea,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        ip_address:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          null,
        user_agent: req.headers.get("user-agent") ?? null,
        template_id: template?.id ?? null,
        signed_storage_path: signedStoragePath,
        signed_file_url: signedFileUrl,
      },
      { onConflict: "client_id" },
    )
    .select("id, signed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("activities").insert({
    client_id: client.id,
    agent_id: client.agent_id,
    type: "note",
    body: `Buyer Broker Agreement signed by ${clientName} (${commissionPct}% · ${termStart} → ${termEnd}).`,
    ai_draft: false,
    approved: true,
    sent: false,
  });

  return NextResponse.json({
    ok: true,
    id: data.id,
    signed_at: data.signed_at,
    signed_pdf_url: signedFileUrl,
  });
}

/**
 * DELETE /api/bba/[clientId]
 * Agent can revoke an agreement. Authed only.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("buyer_broker_agreements")
    .delete()
    .eq("client_id", params.clientId)
    .eq("agent_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
