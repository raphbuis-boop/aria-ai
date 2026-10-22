import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageBrokerage, ensureBrokerage, getBrokerageMembership } from "@/lib/brokerages";
import { formatPhoneE164 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Membership, not the agent_profiles.brokerage_id cache, says which brokerage is theirs.
  let brokerageName = "";
  let canEditBrokerage = true; // no brokerage yet → saving a name creates theirs
  const membership = await getBrokerageMembership(createAdminClient(), user.id).catch((err) => {
    console.error("[settings/profile] brokerage lookup failed", err);
    return null;
  });
  if (membership) {
    canEditBrokerage = canManageBrokerage(membership.role);
    const { data: brokerage } = await supabase
      .from("brokerages")
      .select("name")
      .eq("id", membership.brokerageId)
      .maybeSingle();
    brokerageName = (brokerage?.name as string | undefined) ?? "";
  }

  return NextResponse.json({
    fullName: (profile?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? "",
    email: (profile?.email as string | undefined) ?? user.email ?? "",
    phone: (profile?.phone as string | undefined) ?? "",
    brokerageName,
    canEditBrokerage,
  });
}

export async function PATCH(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  if (typeof body.fullName === "string") {
    const fullName = body.fullName.trim();
    if (!fullName) {
      return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    }
    const { error } = await admin
      .from("agent_profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.phone === "string") {
    const trimmed = body.phone.trim();
    const normalized = trimmed ? formatPhoneE164(trimmed) : "";
    if (trimmed && normalized === null) {
      return NextResponse.json({ error: "That phone number doesn't look right" }, { status: 400 });
    }
    const { error } = await admin
      .from("agent_profiles")
      .update({ phone: normalized || null })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.brokerageName === "string") {
    const name = body.brokerageName.trim();
    if (!name) {
      return NextResponse.json({ error: "Brokerage name can't be empty" }, { status: 400 });
    }
    const { brokerageId, role } = await ensureBrokerage(admin, user.id, user.user_metadata?.full_name);
    if (!canManageBrokerage(role)) {
      return NextResponse.json({ error: "Only your brokerage's owner or admins can rename it." }, { status: 403 });
    }
    const { error } = await admin
      .from("brokerages")
      .update({ name })
      .eq("id", brokerageId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
