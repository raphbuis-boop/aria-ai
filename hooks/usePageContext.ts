"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

export type PageContext = {
  /** Human-readable page name e.g. "Clients", "MLS Search" */
  pageName: string;
  /** Short system prompt addition telling Aria what page the user is on */
  contextHint: string;
};

const ROUTE_MAP: Array<{ pattern: RegExp; name: string; hint: string }> = [
  {
    pattern: /^\/dashboard$/,
    name: "Dashboard",
    hint: "The user is on the main dashboard, which shows their client overview, upcoming showings, transaction pipeline, and new property matches.",
  },
  {
    pattern: /^\/clients\/[^/]+$/,
    name: "Client Detail",
    hint: "The user is viewing a specific client's profile page, which shows their preferences, lead score, activity history, matched properties, and scheduled showings.",
  },
  {
    pattern: /^\/clients$/,
    name: "Clients",
    hint: "The user is on the clients list page, which shows all their active and past clients sorted by lead score.",
  },
  {
    pattern: /^\/mls$/,
    name: "MLS Search",
    hint: "The user is on the MLS property search page, which lets them search NJMLS listings by city, price range, beds, baths, and property type.",
  },
  {
    pattern: /^\/properties$/,
    name: "Properties",
    hint: "The user is on the saved properties page, which shows properties they have saved or matched to clients.",
  },
  {
    pattern: /^\/properties\/[^/]+$/,
    name: "Property Detail",
    hint: "The user is viewing a specific property listing with full details including photos, description, price, and features.",
  },
  {
    pattern: /^\/pipeline$/,
    name: "Pipeline",
    hint: "The user is on the deal pipeline page, which tracks all active transactions through stages from lead to close.",
  },
  {
    pattern: /^\/showings$/,
    name: "Showings",
    hint: "The user is on the showings page, which lists all upcoming and past property showings scheduled for their clients.",
  },
  {
    pattern: /^\/transactions$/,
    name: "Transactions",
    hint: "The user is on the transactions page, which tracks active deals with addresses, closing dates, and statuses.",
  },
  {
    pattern: /^\/inbox$/,
    name: "Inbox",
    hint: "The user is on the inbox / SMS communications page, which shows message threads with clients and lets them send or approve AI-drafted texts.",
  },
  {
    pattern: /^\/inquiries$/,
    name: "Inquiries",
    hint: "The user is on the listing inquiries page, which shows inbound leads from the public property search — people who requested showings or asked questions about listings.",
  },
  {
    pattern: /^\/market/,
    name: "Market Pulse",
    hint: "The user is on the market insights page, which shows local New Jersey real estate market trends and data.",
  },
  {
    pattern: /^\/cma$/,
    name: "CMA",
    hint: "The user is on the Comparative Market Analysis tool, which helps them generate pricing reports for listings.",
  },
  {
    pattern: /^\/ai$/,
    name: "AI Chat",
    hint: "The user is on the dedicated Aria AI chat page.",
  },
  {
    pattern: /^\/settings$/,
    name: "Settings",
    hint: "The user is on the account settings page.",
  },
  {
    pattern: /^\/more$/,
    name: "More",
    hint: "The user is on the more/menu page.",
  },
];

export function usePageContext(): PageContext {
  const pathname = usePathname();

  return useMemo(() => {
    // Strip the leading slash for matching
    const path = pathname ?? "";

    for (const entry of ROUTE_MAP) {
      if (entry.pattern.test(path)) {
        return { pageName: entry.name, contextHint: entry.hint };
      }
    }

    return {
      pageName: "Dashboard",
      contextHint: "The user is using the Aria AI real estate CRM.",
    };
  }, [pathname]);
}
