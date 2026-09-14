import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolContext {
  supabase: SupabaseClient;
  agentId: string;
}

/**
 * Execute a tool by name with the given input and context.
 * This is the single source of truth for tool execution.
 */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<Record<string, unknown> & { success: boolean }> {
  const { supabase } = ctx;

  switch (name) {
    case "get_client_profile": {
      const { clientId } = input as { clientId: string };

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date, source")
        .eq("id", clientId)
        .eq("agent_id", ctx.agentId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, client: data };
    }

    case "search_clients": {
      const { query = "", limit = 10 } = input as { query?: string; limit?: number };

      // Search by name, town, or other fields
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, town, status, lead_score, budget_min, budget_max")
        .eq("agent_id", ctx.agentId)
        .or(`name.ilike.%${query}%,town.ilike.%${query}%`)
        .order("lead_score", { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, clients: data };
    }

    case "update_client_status": {
      const { clientId, status } = input as { clientId: string; status: string };

      const { data, error } = await supabase
        .from("clients")
        .update({ status })
        .eq("id", clientId)
        .eq("agent_id", ctx.agentId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, client: data };
    }

    case "log_activity": {
      const { clientId, type, direction, body = "" } = input as {
        clientId: string;
        type: string;
        direction: string;
        body?: string;
      };

      const { data, error } = await supabase
        .from("activities")
        .insert({
          client_id: clientId,
          agent_id: ctx.agentId,
          type,
          direction,
          body: body || null,
          ai_draft: false,
          approved: true,
          sent: true,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, activity: data };
    }

    case "send_client_message": {
      const { clientId, type, body } = input as {
        clientId: string;
        type: string;
        body: string;
      };

      // First get the client to validate
      const { error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .eq("agent_id", ctx.agentId)
        .single();

      if (clientError) {
        return { success: false, error: clientError.message };
      }

      // Log the activity first
      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .insert({
          client_id: clientId,
          agent_id: ctx.agentId,
          type,
          direction: "outbound",
          body,
          ai_draft: false,
          approved: true,
          sent: true,
        })
        .select()
        .single();

      if (activityError) {
        return { success: false, error: activityError.message };
      }

      // SMS goes out via a native sms: deep link opened client-side (see
      // lib/messaging-links) — this tool only records that it was logged.
      if (type === "text") {
        return {
          success: true,
          activity: activityData,
          message: `Message logged for client ${clientId}. The client surfaces it for the agent to open in Messages.`
        };
      }

      // For email or other types, just return success
      return { success: true, activity: activityData };
    }

    case "get_property_matches": {
      const { clientId, limit = 5 } = input as { clientId: string; limit?: number };

      const { data, error } = await supabase
        .from("property_matches")
        .select(`
          id,
          address,
          price,
          beds,
          baths,
          town,
          status,
          score,
          listings!inner (
            mls_id,
            list_price,
            bedrooms,
            bathrooms,
            property_type,
            street,
            city,
            state,
            zip_code
          )
        `)
        .eq("client_id", clientId)
        .eq("agent_id", ctx.agentId)
        .order("score", { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, matches: data };
    }

    case "schedule_showing": {
      const { clientId, propertyAddress, showingDate } = input as {
        clientId: string;
        propertyAddress: string;
        showingDate: string;
      };

      const { data, error } = await supabase
        .from("showings")
        .insert({
          client_id: clientId,
          agent_id: ctx.agentId,
          address: propertyAddress,
          showing_date: showingDate,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, showing: data };
    }

    case "get_agent_performance": {
      const { timeframe = "30d" } = input as { timeframe?: string };

      // Calculate date range
      const now = new Date();
      let daysAgo = 30;
      if (timeframe === "7d") daysAgo = 7;
      else if (timeframe === "90d") daysAgo = 90;

      const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();

      // Get client counts
      const [
        clientsResult,
        activitiesResult,
        showingsResult,
        dealsResult
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, status", { count: "exact" })
          .eq("agent_id", ctx.agentId),

        supabase
          .from("activities")
          .select("id, type, created_at", { count: "exact" })
          .eq("agent_id", ctx.agentId)
          .gte("created_at", startDate),

        supabase
          .from("showings")
          .select("id, showing_date, status", { count: "exact" })
          .eq("agent_id", ctx.agentId)
          .gte("showing_date", startDate),

        supabase
          .from("clients")
          .select("id", { count: "exact" })
          .eq("agent_id", ctx.agentId)
          .in("status", ["under_contract", "closed"])
          .gte("updated_at", startDate)
      ]);

      if (clientsResult.error) {
        return { success: false, error: clientsResult.error.message };
      }
      if (activitiesResult.error) {
        return { success: false, error: activitiesResult.error.message };
      }
      if (showingsResult.error) {
        return { success: false, error: showingsResult.error.message };
      }
      if (dealsResult.error) {
        return { success: false, error: dealsResult.error.message };
      }

      const clientCount = clientsResult.count ?? 0;
      const activityCount = activitiesResult.count ?? 0;
      const showingCount = showingsResult.count ?? 0;
      const dealCount = dealsResult.count ?? 0;

      // Calculate conversion rate
      const conversionRate = clientCount > 0 ? (dealCount / clientCount) * 100 : 0;

      return {
        success: true,
        performance: {
          timeframe,
          clientCount,
          activityCount: activityCount,
          showingCount: showingCount,
          dealCount: dealCount,
          conversionRate: Number(conversionRate.toFixed(2)),
          activitiesPerClient: clientCount > 0 ? Number((activityCount / clientCount).toFixed(2)) : 0
        }
      };
    }
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}