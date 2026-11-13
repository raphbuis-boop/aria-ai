/**
 * Synthetic demo data for the cinematic landing. Every person and address is
 * fictional. Dates are weekday labels only ("Tue · 88 Park St") so the page
 * never goes stale.
 *
 * What the demo shows must stay true to the production product:
 *  - Ask Aria answers from the agent's own data with its read-only tools
 *    (get_today_priorities, get_hottest_leads, get_stale_clients…). It does not
 *    book showings or create follow-ups; the agent does that in Aria.
 *  - Showings live on the Showings list and on Today. There is no Calendar page,
 *    and Google Calendar events are not shown in Aria.
 *  - Nothing is texted or emailed without the agent approving it. Text drafts
 *    open in the agent's own Messages app; Gmail replies send on the agent's OK.
 *  - Outlook, Google Calendar sync, WhatsApp, Excel import and import undo are
 *    not available yet, so the page does not mention them.
 */

export const DEMO = {
  agentFirstName: "Dana",
  client: { name: "Priya Shah", first: "Priya", initials: "PS", role: "Buyer", town: "Montclair" },
  ask: "Who should I focus on today, and what’s due this week?",
  steps: [
    { label: "Checked today’s priorities", detail: "2 showings" },
    { label: "Ranked your hottest leads", detail: "Priya Shah first" },
    { label: "Found who’s gone quiet", detail: "The Harts · 12 days" },
  ],
  reply:
    "Start with Priya Shah: her showing at 14 Linden Ave is today at 11:00 AM, and the comps you owe her are due Monday. Then check in with the Harts.",
  /** What the answer points to: records the agent already has in Aria. */
  found: [
    { status: "Showing", summary: "Priya Shah: 14 Linden Ave, today at 11:00 AM" },
    { status: "Follow-up", summary: "“Send Priya comps”, due Monday (Priya Shah)" },
  ],
  showing: { who: "Priya Shah", where: "14 Linden Ave", when: "11:00 AM" },
  reminder: { title: "Send Priya comps", due: "Mon" },
} as const;

/** The Showings list in the desktop window. Row 0 (Priya) is rendered by the caller when it lands. */
export const SHOWINGS: { when: string; who: string; where: string }[] = [
  { when: "11:00 AM", who: "Priya Shah", where: "Today · 14 Linden Ave" },
  { when: "1:00 PM", who: "Elena Ruiz", where: "Today · 5 Orchard Ct" },
  { when: "2:00 PM", who: "Marcus Bell", where: "Tue · 88 Park St" },
  { when: "3:00 PM", who: "Owen Park", where: "Thu · 40 Grove St" },
];

/** A past showing: logging the client's feedback gets an AI summary and a follow-up. */
export const PAST_SHOWING = { when: "4:00 PM", who: "The Harts", where: "Wed · 9 Elm Pl · Feedback summarized, follow-up added" };

export type ToolStatus = "live" | "import";

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  live: "Connected",
  import: "CSV import",
};

/**
 * The tools around Aria, each with its true relationship in production today.
 *  - live: works now through a real connection.
 *  - import: the CRM's CSV export is imported. No live sync.
 * Order matters: on desktop the first half (rounded up) sits left of the phone, the rest right.
 */
export const TOOLS: { id: string; name: string; status: ToolStatus; relation: string; mark: string }[] = [
  { id: "gmail", name: "Gmail", status: "live", relation: "Summarizes threads. Drafts replies you approve.", mark: "G" },
  { id: "messages", name: "Messages", status: "live", relation: "Text drafts open on your phone. You press send.", mark: "✉" },
  { id: "contacts", name: "Google Contacts", status: "live", relation: "Direct import with Google sign-in.", mark: "@" },
  { id: "fub", name: "Follow Up Boss", status: "import", relation: "Import its CSV. Duplicates are skipped, never overwritten.", mark: "F" },
  { id: "crms", name: "kvCORE · Salesforce · LionDesk", status: "import", relation: "Import their CSV exports. Aria maps the columns.", mark: "+" },
];
