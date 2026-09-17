import { createAdminClient } from "@/lib/supabase/admin";

/** NJMLS Internet Data Exchange mark — must match filename in `public/` (case-sensitive). */
export const NJMLS_IDX_LOGO_PATH = "/IDX_logo.JPG";

/** Intrinsic pixels of `IDX_logo.JPG` (reserved layout / aspect ratio). */
export const NJMLS_IDX_LOGO_WIDTH = 200;
export const NJMLS_IDX_LOGO_HEIGHT = 25;

/** Generic federal/state boilerplate — safe default, not agent-specific. Overridable in Settings → Compliance. */
export const EQUAL_HOUSING_DISCLOSURE =
  "Equal Housing Opportunity. We are committed to fair housing and do not discriminate on the basis of race, color, religion, sex, disability, familial status, national origin, or any other protected class.";

export type ComplianceProfile = {
  legalName: string | null;
  brokerageName: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  phone: string | null;
  email: string | null;
  businessAddress: string | null;
  fairHousingStatement: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  updatedAt: string | null;
};

const EMPTY_COMPLIANCE_PROFILE: ComplianceProfile = {
  legalName: null,
  brokerageName: null,
  licenseNumber: null,
  licenseState: null,
  phone: null,
  email: null,
  businessAddress: null,
  fairHousingStatement: null,
  supportEmail: null,
  supportPhone: null,
  updatedAt: null,
};

/** Fields that must be filled in before the compliance profile is safe to display publicly. */
export const REQUIRED_COMPLIANCE_FIELDS: (keyof ComplianceProfile)[] = [
  "legalName",
  "brokerageName",
  "licenseNumber",
  "licenseState",
  "phone",
  "email",
  "businessAddress",
];

export function isComplianceProfileComplete(profile: ComplianceProfile): boolean {
  return REQUIRED_COMPLIANCE_FIELDS.every((field) => Boolean(profile[field]?.trim()));
}

function rowToProfile(row: Record<string, unknown> | null): ComplianceProfile {
  if (!row) return EMPTY_COMPLIANCE_PROFILE;
  return {
    legalName: (row.legal_name as string | null) ?? null,
    brokerageName: (row.brokerage_name as string | null) ?? null,
    licenseNumber: (row.license_number as string | null) ?? null,
    licenseState: (row.license_state as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    businessAddress: (row.business_address as string | null) ?? null,
    fairHousingStatement: (row.fair_housing_statement as string | null) ?? null,
    supportEmail: (row.support_email as string | null) ?? null,
    supportPhone: (row.support_phone as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

/** Server-only — for use in Server Components / API routes. Never throws; returns empty fields on error. */
export async function getComplianceProfileServer(): Promise<ComplianceProfile> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("compliance_profile")
      .select(
        "legal_name, brokerage_name, license_number, license_state, phone, email, business_address, fair_housing_statement, support_email, support_phone, updated_at",
      )
      .eq("id", 1)
      .maybeSingle();
    return rowToProfile(data);
  } catch {
    return EMPTY_COMPLIANCE_PROFILE;
  }
}

/**
 * NJMLS IDX agreement — official wording (page 7). `[DATE]` = MM/DD/YYYY for `date`.
 * `brokerageName` is null-safe: falls back to generic phrasing rather than a fabricated name.
 */
export function getIdxDisclaimerText(brokerageName: string | null, date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  const brokerageClause = brokerageName
    ? `Real estate listings held by brokerage firms other than ${brokerageName} are marked with the Internet Data Exchange logo`
    : "Real estate listings held by other participating brokerage firms are marked with the Internet Data Exchange logo";
  return `The data relating to the real estate for sale on this web site comes in part from the Internet Data Exchange Program of the NJMLS. ${brokerageClause} and information about them includes the name of the listing brokers. Some properties listed with the participating brokers do not appear on this website at the request of the seller. Listings of brokers that do not participate in Internet Data Exchange do not appear on this website. All information deemed reliable but not guaranteed. Last date updated: ${dateStr}. Source: New Jersey Multiple Listing Service, Inc. © 2026 New Jersey Multiple Listing Service, Inc. All rights reserved.`;
}
