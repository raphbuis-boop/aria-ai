/**
 * Where "Search MLS" goes while Aria has no working MLS feed: the agent's
 * own NJMLS portal, opened in a new tab. Change it with
 * NEXT_PUBLIC_MLS_PORTAL_URL (e.g. a board-specific login page).
 */
export const MLS_PORTAL_URL = process.env.NEXT_PUBLIC_MLS_PORTAL_URL?.trim() || "https://www.njmls.com";
