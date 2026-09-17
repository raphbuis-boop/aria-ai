import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneE164 } from "@/lib/utils";
import {
  getComplianceProfileServer,
  isComplianceProfileComplete,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

/** Public — the compliance footer/IDX notice render on unauthenticated pages. */
export async function GET() {
  const profile = await getComplianceProfileServer();
  return NextResponse.json({ ...profile, isComplete: isComplianceProfileComplete(profile) });
}

const EDITABLE_TEXT_FIELDS: Record<string, string> = {
  legalName: "legal_name",
  brokerageName: "brokerage_name",
  licenseNumber: "license_number",
  licenseState: "license_state",
  email: "email",
  businessAddress: "business_address",
  fairHousingStatement: "fair_housing_statement",
  supportEmail: "support_email",
};

export async function PATCH(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, string | null> = {};

  for (const [bodyKey, column] of Object.entries(EDITABLE_TEXT_FIELDS)) {
    if (typeof body[bodyKey] === "string") {
      update[column] = body[bodyKey].trim() || null;
    }
  }

  if (typeof body.phone === "string") {
    const trimmed = body.phone.trim();
    const normalized = trimmed ? formatPhoneE164(trimmed) : null;
    if (trimmed && normalized === null) {
      return NextResponse.json({ error: "That phone number doesn't look right" }, { status: 400 });
    }
    update.phone = normalized;
  }

  if (typeof body.supportPhone === "string") {
    const trimmed = body.supportPhone.trim();
    const normalized = trimmed ? formatPhoneE164(trimmed) : null;
    if (trimmed && normalized === null) {
      return NextResponse.json({ error: "That support phone number doesn't look right" }, { status: 400 });
    }
    update.support_phone = normalized;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("compliance_profile")
    .update({ ...update, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = await getComplianceProfileServer();
  return NextResponse.json({ ...profile, isComplete: isComplianceProfileComplete(profile) });
}
