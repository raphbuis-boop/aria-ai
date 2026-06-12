import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool (function-calling) schemas exposed to Claude.
 *
 * These are *contracts only* — the runtime logic lives in `tool-handlers.ts`.
 * Claude reads these schemas to decide which tool to call and how to shape the
 * arguments. The orchestrator (`lib/ai/agent.ts`) then routes each `tool_use`
 * block to the matching handler and feeds the real result back to the model.
 *
 * Anti-hallucination contract: every description makes clear that the action is
 * NOT performed by emitting the tool call — it is only performed when the
 * handler returns `{ success: true }`. The model must wait for the tool_result.
 */

export const TOOL_NAMES = {
  searchMlsProperties: "search_mls_properties",
  getClientPreferences: "get_client_preferences",
  sendClientMessage: "send_client_message",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const ariaTools: Anthropic.Tool[] = [
  {
    name: TOOL_NAMES.searchMlsProperties,
    description:
      "Search the live New Jersey MLS (SimplyRETS) for active for-sale listings " +
      "matching geographic and price/size criteria. Use this whenever the agent " +
      "asks about real inventory, current listings, or 'what's on the market'. " +
      "Returns real listings from the MLS feed — never invent addresses, prices, " +
      "or MLS numbers. If the result list is empty, tell the agent nothing matched " +
      "rather than fabricating properties.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description:
            "Town or city to search, e.g. 'Ridgewood'. Required. Use the client's " +
            "preferred town if searching on a client's behalf.",
        },
        state: {
          type: "string",
          description:
            "Two-letter state code to scope the search, e.g. 'NJ'. Optional.",
        },
        minPrice: {
          type: "number",
          description: "Minimum list price in whole US dollars. Optional.",
        },
        maxPrice: {
          type: "number",
          description: "Maximum list price in whole US dollars. Optional.",
        },
        minBeds: {
          type: "number",
          description: "Minimum number of bedrooms. Optional.",
        },
        minBaths: {
          type: "number",
          description: "Minimum number of bathrooms. Optional.",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of listings to return (1-25). Defaults to 10.",
        },
      },
      required: ["city"],
    },
  },
  {
    name: TOOL_NAMES.getClientPreferences,
    description:
      "Look up a buyer client's saved search preferences (budget, preferred " +
      "towns, beds/baths wanted, status, contact info) from the agent's Supabase " +
      "CRM. Use this before searching the MLS on a client's behalf, or whenever " +
      "the agent references a client by name and you need their criteria. " +
      "Returns only clients that belong to the authenticated agent.",
    input_schema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description:
            "The client's UUID, if known. Preferred when available — it is exact.",
        },
        client_name: {
          type: "string",
          description:
            "The client's name (full or partial) to look up, e.g. 'Sarah' or " +
            "'Sarah Chen'. Used only when client_id is not known.",
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.sendClientMessage,
    description:
      "Send a real SMS text message to a client via Twilio and log it to the CRM " +
      "activity thread. This performs a REAL, irreversible action: an actual text " +
      "is delivered to the client's phone. Only call this when the agent has " +
      "clearly asked to send/text a specific message to a specific client. " +
      "Do NOT claim the message was sent until this tool returns { success: true } " +
      "with a messageSid — if it returns success: false, relay the error and do " +
      "not pretend the text went out.",
    input_schema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The recipient client's UUID, if known. Preferred.",
        },
        client_name: {
          type: "string",
          description:
            "The recipient client's name (full or partial), used only when " +
            "client_id is not known.",
        },
        message: {
          type: "string",
          description:
            "The exact SMS text to send. Plain text, no markdown or placeholders. " +
            "Write it in the agent's natural voice.",
        },
      },
      required: ["message"],
    },
  },
];
