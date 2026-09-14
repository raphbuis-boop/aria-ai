import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Definition of all tools available to the Aria AI agent.
 * These tools allow the agent to interact with the CRM system.
 */
export const ariaTools: Tool[] = [
  {
    name: "get_client_profile",
    description: "Get a client's profile information by ID",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client to retrieve",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "search_clients",
    description: "Search for clients by name, town, or other criteria",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (name, town, etc.)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10,
        },
      },
    },
  },
  {
    name: "update_client_status",
    description: "Update a client's status (e.g., new, contacted, showing, offer, under_contract, closed)",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client to update",
        },
        status: {
          type: "string",
          enum: ["new", "contacted", "showing", "offer", "under_contract", "closed"],
          description: "The new status for the client",
        },
      },
      required: ["clientId", "status"],
    },
  },
  {
    name: "log_activity",
    description: "Log an activity (call, text, email, showing, note, offer) for a client",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client",
        },
        type: {
          type: "string",
          enum: ["text", "call", "email", "showing", "note", "offer"],
          description: "The type of activity",
        },
        direction: {
          type: "string",
          enum: ["inbound", "outbound"],
          description: "Direction of the activity",
        },
        body: {
          type: "string",
          description: "Content/notes for the activity",
        },
      },
      required: ["clientId", "type", "direction"],
    },
  },
  {
    name: "send_client_message",
    description: "Send a message to a client (text, email, etc.)",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client",
        },
        type: {
          type: "string",
          enum: ["text", "email"],
          description: "Type of message to send",
        },
        body: {
          type: "string",
          description: "The message content to send",
        },
      },
      required: ["clientId", "type", "body"],
    },
  },
  {
    name: "get_property_matches",
    description: "Get property matches for a client from the MLS",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client to get matches for",
        },
        limit: {
          type: "number",
          description: "Maximum number of matches to return",
          default: 5,
        },
      },
    },
  },
  {
    name: "schedule_showing",
    description: "Schedule a property showing for a client",
    input_schema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The ID of the client",
        },
        propertyAddress: {
          type: "string",
          description: "The address of the property to show",
        },
        showingDate: {
          type: "string",
          description: "The date and time for the showing (ISO string)",
        },
      },
      required: ["clientId", "propertyAddress", "showingDate"],
    },
  },
  {
    name: "get_agent_performance",
    description: "Get performance metrics for the agent (lead conversion, response times, etc.)",
    input_schema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["7d", "30d", "90d"],
          description: "Timeframe for the metrics",
          default: "30d",
        },
      },
    },
  },
];