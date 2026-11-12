/**
 * Synthetic demo data for the cinematic landing. Every person and address is
 * fictional. Dates are weekday labels only ("Sat 11:00 AM") so the page never
 * goes stale.
 *
 * What the demo shows must stay true to the product:
 *  - The request runs through the Aria agent's real tools (find the client,
 *    schedule_showing, create_task) and the reply mirrors their real wording.
 *  - Booked showings live on Aria's Calendar. Google Calendar events are shown
 *    beside them, read-only. Aria does not write agent-booked showings to Google.
 *  - Nothing is texted or emailed without the agent approving it. Text drafts
 *    open in the agent's own Messages app.
 */

export const DEMO = {
  agentFirstName: "Dana",
  client: { name: "Priya Shah", first: "Priya", initials: "PS", role: "Buyer", town: "Montclair" },
  ask: "Book Priya Shah a showing at 14 Linden Ave, Montclair, Saturday at 11, and remind me to send her comps Monday.",
  steps: [
    { label: "Found Priya Shah", detail: "Buyer · Montclair" },
    { label: "Booked the showing", detail: "Sat 11:00 AM" },
    { label: "Set a reminder", detail: "Monday" },
  ],
  reply:
    "Done. Priya's showing at 14 Linden Ave is booked for Saturday at 11:00 AM. It's on Today and the Calendar. I'll remind you Monday to send her comps.",
  changes: [
    { status: "Done", summary: "Showing booked with Priya Shah: 14 Linden Ave on Sat 11:00 AM" },
    { status: "Done", summary: "Reminder for Monday: “Send Priya comps” (Priya Shah)" },
  ],
  showing: { who: "Priya Shah", where: "14 Linden Ave", when: "Sat 11:00 AM", day: 5, hour: 11 },
  reminder: { title: "Send Priya comps", due: "Mon" },
} as const;

export type WeekEvent = {
  id: string;
  /** 0 = Monday … 6 = Sunday */
  day: number;
  /** Start hour, 24h. Grid shows 9 AM – 4 PM. */
  hour: number;
  /** Duration in hours. */
  span: number;
  kind: "showing" | "task" | "calendar";
  title: string;
  who?: string;
};

/** The rest of the agent's week. `calendar` events come from Google Calendar and are read-only in Aria. */
export const WEEK: WeekEvent[] = [
  { id: "g1", day: 0, hour: 9, span: 1, kind: "calendar", title: "Listing appt" },
  { id: "s1", day: 1, hour: 14, span: 1, kind: "showing", title: "88 Park St", who: "Marcus Bell" },
  { id: "t1", day: 2, hour: 10, span: 1, kind: "task", title: "Call lender", who: "The Harts" },
  { id: "g2", day: 3, hour: 13, span: 1, kind: "calendar", title: "Office meeting" },
  { id: "s2", day: 4, hour: 12, span: 1, kind: "showing", title: "5 Orchard Ct", who: "Elena Ruiz" },
  { id: "g3", day: 5, hour: 13, span: 2, kind: "calendar", title: "Open house · 212 Valley Rd" },
  { id: "s3", day: 3, hour: 15, span: 1, kind: "showing", title: "40 Grove St", who: "Owen Park" },
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const GRID_START_HOUR = 9;
export const GRID_HOURS = 7; // 9 AM – 4 PM

export type ToolStatus = "live" | "import" | "rolling";

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  live: "Connected",
  import: "CSV / Excel import",
  rolling: "Rolling out",
};

/**
 * The tools around Aria, each with its true relationship today.
 *  - live: works now through a real connection.
 *  - import: the CRM's own export file is recognised by Aria's importer. No live sync.
 *  - rolling: built, enabled per account; not generally available.
 */
export const TOOLS: { id: string; name: string; status: ToolStatus; relation: string; mark: string }[] = [
  { id: "gmail", name: "Gmail", status: "live", relation: "Reads threads. Drafts replies you approve.", mark: "G" },
  { id: "outlook", name: "Outlook", status: "live", relation: "Same inbox, same approve-first sending.", mark: "O" },
  { id: "gcal", name: "Google Calendar", status: "live", relation: "Your events, shown read-only beside Aria’s showings.", mark: "31" },
  { id: "contacts", name: "Google Contacts", status: "live", relation: "Direct import with Google sign-in.", mark: "@" },
  { id: "messages", name: "Messages", status: "live", relation: "Text drafts open on your phone. You press send.", mark: "✉" },
  { id: "whatsapp", name: "WhatsApp", status: "rolling", relation: "Message Aria on WhatsApp, where enabled for your account.", mark: "W" },
  { id: "fub", name: "Follow Up Boss", status: "import", relation: "Import its export. Duplicates merge, never overwrite.", mark: "F" },
  { id: "crms", name: "kvCORE · Salesforce · LionDesk", status: "import", relation: "Import their exports. Undo any import.", mark: "+" },
];
