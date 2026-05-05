export const AGENT_NAME = "Michelle Wasserlauf";
export const AGENT_LICENSE = "1324799";
export const BROKERAGE_NAME = "eXp Realty";
export const BROKERAGE_LICENSE = "1008658";
export const BROKERAGE_ADDRESS = "28 Valley Road, Montclair, NJ";
export const BROKERAGE_PHONE = "(866) 201-6210";

/** NJMLS Internet Data Exchange mark — must match filename in `public/` (case-sensitive). */
export const NJMLS_IDX_LOGO_PATH = "/njmls-logo.jpg";

/** Intrinsic pixels of `njmls-logo.jpg` (reserved layout / aspect ratio). */
export const NJMLS_IDX_LOGO_WIDTH = 200;
export const NJMLS_IDX_LOGO_HEIGHT = 25;

/**
 * NJMLS IDX agreement — official wording (page 7). `[DATE]` = MM/DD/YYYY for `date`;
 * brokerage clause uses {@link BROKERAGE_NAME}. Copyright year fixed per agreement text.
 */
export function getIdxDisclaimerText(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  return `The data relating to the real estate for sale on this web site comes in part from the Internet Data Exchange Program of the NJMLS. Real estate listings held by brokerage firms other than ${BROKERAGE_NAME} are marked with the Internet Data Exchange logo and information about them includes the name of the listing brokers. Some properties listed with the participating brokers do not appear on this website at the request of the seller. Listings of brokers that do not participate in Internet Data Exchange do not appear on this website. All information deemed reliable but not guaranteed. Last date updated: ${dateStr}. Source: New Jersey Multiple Listing Service, Inc. © 2026 New Jersey Multiple Listing Service, Inc. All rights reserved.`;
}

/** Same as {@link getIdxDisclaimerText} — NJMLS `IDX_DISCLAIMER_TEXT` entry point. */
export { getIdxDisclaimerText as IDX_DISCLAIMER_TEXT };

export const EQUAL_HOUSING_DISCLOSURE =
  "Equal Housing Opportunity. We are committed to fair housing and do not discriminate on the basis of race, color, religion, sex, disability, familial status, national origin, or any other protected class.";
