import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GmailConfigError,
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/gmail/client";
import {
  renderEmailBody,
  renderPropertyCard,
  type PropertyCardData,
} from "@/lib/gmail/html";
import {
  buildRawMime,
  sendViaGmail,
  type OutgoingAttachment,
} from "@/lib/gmail/mime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SendBody {
  clientId?: string;
  to: string;
  subject: string;
  /** Rich HTML body from the composer (tiptap output). */
  bodyHtml: string;
  templateId?: string | null;
  /** When set, inline property card is appended to the body. */
  propertyId?: string | null;
  /** When true, attach the latest BBA PDF for this client. */
  attachBba?: boolean;
  inReplyTo?: string | null;
  references?: string[] | null;
  threadId?: string | null;
}

async function loadPropertyCard(
  adminClient: ReturnType<typeof createAdminClient>,
  propertyId: string | null | undefined,
): Promise<PropertyCardData | null> {
  if (!propertyId) return null;
  const { data } = await adminClient
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return null;
  const obj = data as Record<string, unknown>;
  const photos: string[] = Array.isArray(obj.photos)
    ? (obj.photos as unknown[]).filter(
        (p): p is string => typeof p === "string" && !!p,
      )
    : typeof obj.photo_url === "string" && obj.photo_url
      ? [obj.photo_url as string]
      : [];
  return {
    address: (obj.address as string | null) ?? null,
    city: (obj.city as string | null) ?? (obj.town as string | null) ?? null,
    state: (obj.state as string | null) ?? null,
    postalCode:
      (obj.postal_code as string | null) ??
      (obj.zip as string | null) ??
      null,
    price: (obj.price as number | null) ?? null,
    beds: (obj.beds as number | null) ?? null,
    baths: (obj.baths as number | null) ?? null,
    sqft: (obj.sqft as number | null) ?? null,
    mlsNumber:
      (obj.mls_number as string | null) ?? (obj.mls_id as string | null) ?? null,
    photos,
    detailUrl: (obj.listing_url as string | null) ?? null,
  };
}

async function loadBbaAttachment(
  adminClient: ReturnType<typeof createAdminClient>,
  clientId: string,
  agentId: string,
): Promise<OutgoingAttachment | null> {
  const { data: bba } = await adminClient
    .from("buyer_broker_agreements")
    .select("id, signed_storage_path, client_name")
    .eq("client_id", clientId)
    .eq("agent_id", agentId)
    .not("signed_storage_path", "is", null)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!bba?.signed_storage_path) return null;

  const { data: file, error } = await adminClient.storage
    .from("bba-templates")
    .download(String(bba.signed_storage_path));
  if (error || !file) return null;

  const arrayBuf = await file.arrayBuffer();
  const safeName =
    (bba.client_name ? String(bba.client_name) : "client")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase() + "-bba.pdf";
  return {
    filename: safeName,
    content: Buffer.from(arrayBuf),
    contentType: "application/pdf",
  };
}

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SendBody;
  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const bodyHtml = String(body.bodyHtml ?? "");

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid to address" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject required" }, { status: 400 });
  }
  if (!bodyHtml.trim()) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Agent profile for the email signature.
  const { data: profile } = await admin
    .from("agent_profiles")
    .select("full_name, phone, email")
    .eq("id", user.id)
    .maybeSingle();
  const agentName = (profile?.full_name as string | null) ?? null;
  const agentPhone = (profile?.phone as string | null) ?? null;

  // Property inline card (Option A default).
  let innerHtml = bodyHtml;
  let propertyId: string | null = null;
  if (body.propertyId) {
    const card = await loadPropertyCard(admin, body.propertyId);
    if (card) {
      innerHtml = `${bodyHtml}\n${renderPropertyCard(card)}`;
      propertyId = body.propertyId;
    }
  }

  // BBA attachment (Option B for BBA specifically — actual PDF).
  const attachments: OutgoingAttachment[] = [];
  if (body.attachBba && body.clientId) {
    const pdf = await loadBbaAttachment(admin, body.clientId, user.id);
    if (pdf) attachments.push(pdf);
  }

  let gmailHandle;
  try {
    gmailHandle = await getGmailClient(user.id);
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return NextResponse.json(
        { error: "Gmail not connected. Connect in Settings." },
        { status: 400 },
      );
    }
    if (e instanceof GmailConfigError) {
      return NextResponse.json(
        { error: "Gmail OAuth not configured on this deployment." },
        { status: 501 },
      );
    }
    throw e;
  }

  const fullHtml = renderEmailBody(innerHtml, {
    agentName,
    agentEmail: gmailHandle.emailAddress,
    agentPhone,
  });

  // Pre-flight check: the MIME assembly can fail for oversized attachments.
  try {
    await buildRawMime({
      from: gmailHandle.emailAddress,
      fromName: agentName,
      to,
      subject,
      html: fullHtml,
      attachments,
      inReplyTo: body.inReplyTo ?? null,
      references: body.references ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mime_build_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let result;
  try {
    result = await sendViaGmail(
      gmailHandle.gmail,
      {
        from: gmailHandle.emailAddress,
        fromName: agentName,
        to,
        subject,
        html: fullHtml,
        attachments,
        inReplyTo: body.inReplyTo ?? null,
        references: body.references ?? null,
      },
      body.threadId ?? undefined,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Log to sent_emails.
  const preview = bodyHtml
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  await admin.from("sent_emails").insert({
    agent_id: user.id,
    client_id: body.clientId ?? null,
    to_address: to,
    from_address: gmailHandle.emailAddress,
    subject,
    body_preview: preview,
    gmail_message_id: result.gmailMessageId,
    gmail_thread_id: result.gmailThreadId,
    property_id: propertyId,
    template_id: body.templateId ?? null,
  });

  // Mirror into activities so the client-detail timeline shows it.
  if (body.clientId) {
    await admin.from("activities").insert({
      agent_id: user.id,
      client_id: body.clientId,
      type: "email",
      body: `${subject}\n\n${preview}`,
      ai_draft: false,
      approved: true,
      sent: true,
    });
  }

  return NextResponse.json({
    ok: true,
    gmailMessageId: result.gmailMessageId,
    gmailThreadId: result.gmailThreadId,
  });
}
