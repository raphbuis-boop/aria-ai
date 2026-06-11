// ---------------------------------------------------------------------------
// DEFAULT identity — used on the generic /property-search page and anywhere
// no specific agent context is available. These are Michelle's eXp credentials.
// ---------------------------------------------------------------------------
export const DEFAULT_AGENT_NAME = "Michelle Wasserlauf";
export const DEFAULT_AGENT_LICENSE = "1324799";
export const DEFAULT_BROKERAGE_NAME = "eXp Realty";
export const DEFAULT_BROKERAGE_LICENSE = "1008658";
export const DEFAULT_BROKERAGE_ADDRESS = "28 Valley Road, Montclair, NJ";
export const DEFAULT_BROKERAGE_PHONE = "(866) 201-6210";

// Backwards-compatible aliases — existing import sites continue to work
// without changes. Remove these in Phase 2 once all callers use DEFAULT_*.
export const AGENT_NAME = DEFAULT_AGENT_NAME;
export const AGENT_LICENSE = DEFAULT_AGENT_LICENSE;
export const BROKERAGE_NAME = DEFAULT_BROKERAGE_NAME;
export const BROKERAGE_LICENSE = DEFAULT_BROKERAGE_LICENSE;
export const BROKERAGE_ADDRESS = DEFAULT_BROKERAGE_ADDRESS;
export const BROKERAGE_PHONE = DEFAULT_BROKERAGE_PHONE;

/** NJMLS Internet Data Exchange mark — must match filename in `public/` (case-sensitive). */
export const NJMLS_IDX_LOGO_PATH = "/IDX_logo.JPG";

/** Intrinsic pixels of `IDX_logo.JPG` (reserved layout / aspect ratio). */
export const NJMLS_IDX_LOGO_WIDTH = 200;
export const NJMLS_IDX_LOGO_HEIGHT = 25;

/**
 * NJMLS IDX agreement — official wording (page 7). `[DATE]` = MM/DD/YYYY for `date`;
 * brokerage clause uses {@link DEFAULT_BROKERAGE_NAME}. Copyright year fixed per agreement text.
 */
export function getIdxDisclaimerText(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  return `The data relating to the real estate for sale on this web site comes in part from the Internet Data Exchange Program of the NJMLS. Real estate listings held by brokerage firms other than ${DEFAULT_BROKERAGE_NAME} are marked with the Internet Data Exchange logo and information about them includes the name of the listing brokers. Some properties listed with the participating brokers do not appear on this website at the request of the seller. Listings of brokers that do not participate in Internet Data Exchange do not appear on this website. All information deemed reliable but not guaranteed. Last date updated: ${dateStr}. Source: New Jersey Multiple Listing Service, Inc. © 2026 New Jersey Multiple Listing Service, Inc. All rights reserved.`;
}

/**
 * Per-agent IDX disclaimer for NJMLS Section 13.1 compliance.
 * Uses the agent's own brokerage identity when present; falls back to the
 * DEFAULT_* constants (Michelle / eXp) for the generic /property-search page.
 *
 * TODO(Phase 2): call this in IdxComplianceNotice and ComplianceFooter once
 * agents have their own shareable public links. Pass the agent_profiles row
 * for the agent whose link the visitor is viewing.
 */
export function getIdxDisclaimerForAgent(
  agentProfile: {
    brokerage_name?: string | null;
    agent_full_name?: string | null;
    agent_license?: string | null;
  } | null,
  date = new Date(),
): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  const brokerageName = agentProfile?.brokerage_name ?? DEFAULT_BROKERAGE_NAME;
  return `The data relating to the real estate for sale on this web site comes in part from the Internet Data Exchange Program of the NJMLS. Real estate listings held by brokerage firms other than ${brokerageName} are marked with the Internet Data Exchange logo and information about them includes the name of the listing brokers. Some properties listed with the participating brokers do not appear on this website at the request of the seller. Listings of brokers that do not participate in Internet Data Exchange do not appear on this website. All information deemed reliable but not guaranteed. Last date updated: ${dateStr}. Source: New Jersey Multiple Listing Service, Inc. © 2026 New Jersey Multiple Listing Service, Inc. All rights reserved.`;
}

/** Same as {@link getIdxDisclaimerText} — NJMLS `IDX_DISCLAIMER_TEXT` entry point. */
export { getIdxDisclaimerText as IDX_DISCLAIMER_TEXT };

export const EQUAL_HOUSING_DISCLOSURE =
  "Equal Housing Opportunity. We are committed to fair housing and do not discriminate on the basis of race, color, religion, sex, disability, familial status, national origin, or any other protected class.";
