import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBbaSigned } from "@/lib/sms/bba";
import { BBA_REQUEST_COLUMNS, bbaRequestClosedReason, isBbaToken, type BbaRequest } from "@/lib/bba";

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

type Admin = ReturnType<typeof createAdminClient>;

async function loadRequest(admin: Admin, token: string): Promise<BbaRequest | null> {
  if (!isBbaToken(token)) return null;
  const { data } = await admin.from("bba_requests").select(BBA_REQUEST_COLUMNS).eq("token", token).maybeSingle();
  return (data as BbaRequest | null) ?? null;
}

/** The template the agent's terms were issued with (null → inline summary). */
async function loadTemplate(admin: Admin, templateId: string | null): Promise<BbaTemplateRow | null> {
  if (!templateId) return null;
  const { data } = await admin
    .from("brokerage_bba_templates")
    .select("id, brokerage_id, storage_path, template_name, is_default")
    .eq("id", templateId)
    .maybeSingle();
  return (data as BbaTemplateRow | null) ?? null;
}

/**
 * GET /api/bba/sign/[token]
 * Public (no auth) so the /bba/sign/[token] page can render for the buyer.
 * Returns the agent-set terms (read-only on the page), the template to
 * preview, and any agreement already on file. Expired, voided or used links
 * get 410 with the reason.
 */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const admin = createAdminClient();
  const request = await loadRequest(admin, params.token);
  if (!request) {
    return NextResponse.json({ error: "This signing link isn't valid." }, { status: 404 });
  }
  const closed = bbaRequestClosedReason(request);
  if (closed) return NextResponse.json({ error: closed }, { status: 410 });

  const [{ data: client }, { data: bba }, template] = await Promise.all([
    admin.from("clients").select("name").eq("id", request.client_id).maybeSingle(),
    admin
      .from("buyer_broker_agreements")
      .select("signed_at, commission_pct, term_start, term_end, signed_storage_path")
      .eq("client_id", request.client_id)
      .is("superseded_at", null)
      .maybeSingle(),
    loadTemplate(admin, request.template_id),
  ]);
  if (!client) {
    return NextResponse.json({ error: "This signing link isn't valid." }, { status: 404 });
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
    client: { name: client.name },
    agent: { name: request.agent_name },
    terms: {
      commission_pct: Number(request.commission_pct),
      term_start: request.term_start,
      term_end: request.term_end,
      search_area: request.search_area,
    },
    expires_at: request.expires_at,
    bba: bba
      ? {
          signed_at: bba.signed_at,
          commission_pct: Number(bba.commission_pct),
          term_start: bba.term_start,
          term_end: bba.term_end,
        }
      : null,
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
 * POST /api/bba/sign/[token]  { clientName, signatureData }
 * The buyer's legal name and signature (base64 PNG data URL) are the only
 * inputs. Commission, term, search area, agent and template all come from
 * the agent's request — anything else in the body is ignored.
 *
 * The link is claimed before anything is written, so it can be signed once;
 * if saving the agreement fails the claim is released.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const body = await req.json().catch(() => ({}));
  const clientName = String(body.clientName ?? "").trim().slice(0, 200);
  const signatureData = String(body.signatureData ?? "");

  if (!clientName) {
    return NextResponse.json({ error: "Please enter your full legal name." }, { status: 400 });
  }
  if (!signatureData.startsWith("data:image/png;base64,") || signatureData.length > 2_000_000) {
    return NextResponse.json({ error: "Please draw your signature to continue." }, { status: 400 });
  }

  const admin = createAdminClient();
  const request = await loadRequest(admin, params.token);
  if (!request) {
    return NextResponse.json({ error: "This signing link isn't valid." }, { status: 404 });
  }
  const closed = bbaRequestClosedReason(request);
  if (closed) return NextResponse.json({ error: closed }, { status: 410 });

  const signedAt = new Date();
  const { data: claimed } = await admin
    .from("bba_requests")
    .update({ signed_at: signedAt.toISOString() })
    .eq("id", request.id)
    .is("signed_at", null)
    .is("voided_at", null)
    .gt("expires_at", signedAt.toISOString())
    .select("id");
  if (!claimed?.length) {
    return NextResponse.json({ error: "This signing link was already used or has expired." }, { status: 410 });
  }
  const release = () => admin.from("bba_requests").update({ signed_at: null }).eq("id", request.id);

  const commissionPct = Number(request.commission_pct);
  const termStart = request.term_start;
  const termEnd = request.term_end;
  const template = await loadTemplate(admin, request.template_id);

  // Every signature is a new agreement version with its own PDF; earlier
  // versions (and their files) are kept.
  const bbaId = crypto.randomUUID();

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
        signedAt,
        commissionPct,
        termStart,
        termEnd,
      });

      signedStoragePath = `${template.brokerage_id}/signed/${bbaId}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(signedStoragePath, Buffer.from(signedBytes), {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(signedStoragePath, 60 * 60); // for this response only; sign again on read
      signedFileUrl = signed?.signedUrl ?? null;
    } catch (err) {
      // PDF step failed — fall through to text-only agreement so we still
      // capture the signature. Surface the error in server logs.
      console.error("[bba/sign] pdf embed failed:", err);
      signedStoragePath = null;
      signedFileUrl = null;
    }
  }

  // Supersedes the client's current agreement (if any) and inserts this one
  // in a single transaction.
  const { data, error } = await admin.rpc("record_bba_signature", {
    agreement: {
      id: bbaId,
      client_id: request.client_id,
      agent_id: request.agent_id,
      agent_name: request.agent_name,
      client_name: clientName,
      commission_pct: commissionPct,
      term_start: termStart,
      term_end: termEnd,
      search_area: request.search_area,
      signature_data: signatureData,
      signed_at: signedAt.toISOString(),
      ip_address:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        null,
      user_agent: req.headers.get("user-agent") ?? null,
      template_id: template?.id ?? null,
      signed_storage_path: signedStoragePath,
    },
  });

  if (error || !data) {
    await release();
    if (signedStoragePath) await admin.storage.from(BUCKET).remove([signedStoragePath]);
    console.error("[bba/sign] saving agreement failed:", error?.message ?? "no row returned");
    return NextResponse.json({ error: "Could not save the agreement. Please try again." }, { status: 500 });
  }

  await admin.from("bba_requests").update({ bba_id: data.id }).eq("id", request.id);

  await admin.from("activities").insert({
    client_id: request.client_id,
    agent_id: request.agent_id,
    type: "note",
    body: `Buyer Broker Agreement signed by ${clientName} (${commissionPct}% · ${termStart} → ${termEnd}).`,
    ai_draft: false,
    approved: true,
    sent: false,
  });

  try {
    await onBbaSigned(admin, request.client_id, signedFileUrl);
  } catch (err) {
    console.error("[bba/sign] post-sign follow-up failed:", err);
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    signed_at: data.signed_at,
    signed_pdf_url: signedFileUrl,
  });
}
