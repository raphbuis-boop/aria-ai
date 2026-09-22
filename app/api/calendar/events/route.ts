import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { google, calendar_v3 } from "googleapis";
import { makeOAuth2Client } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getRouteSupabase();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get the Google integration for this user
    const { data: integration, error } = await supabase
      .from("gmail_integrations")
      .select("access_token, refresh_token, token_expiry")
      .eq("agent_id", user.id)
      .single();

    if (error || !integration) {
      return NextResponse.json(
        { error: "Google account not connected" }, 
        { status: 400 }
      );
    }

    // Create OAuth2 client and set credentials
    const auth = makeOAuth2Client();
    auth.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: new Date(integration.token_expiry).getTime(),
    });

    // Auto-refresh if expired (or within 60s of expiry)
    const expiryMs = new Date(integration.token_expiry).getTime();
    if (Date.now() >= expiryMs - 60_000) {
      try {
        const { credentials } = await auth.refreshAccessToken();
        auth.setCredentials(credentials);

        if (credentials.access_token) {
          await supabase
            .from("gmail_integrations")
            .update({
              access_token: credentials.access_token,
              token_expiry: new Date(credentials.expiry_date ?? Date.now() + 3600_000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("agent_id", user.id);
        }
      } catch (err) {
        // Never log the raw Gaxios error: it embeds the refresh token.
        console.error(
          "[calendar] token refresh failed for agent",
          user.id,
          err instanceof Error ? err.message : "unknown error",
        );
        return NextResponse.json(
          { error: "Failed to refresh Google token" }, 
          { status: 401 }
        );
      }
    }

    // Create Google Calendar API client
    const calendar = google.calendar({ version: "v3", auth });

    // Get events for the next 14 days
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const eventsResponse = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: twoWeeksLater.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = eventsResponse.data.items || [];

    // Transform events to a simplified format
    const simplifiedEvents = events.map((event: calendar_v3.Schema$Event) => ({
      id: event.id,
      title: event.summary || "No Title",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || "",
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName || a.email,
        responseStatus: a.responseStatus
      })) || [],
      created: event.created,
      updated: event.updated,
    }));

    return NextResponse.json({ events: simplifiedEvents });
  } catch (error) {
    console.error("[calendar/events] Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getRouteSupabase();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get the Google integration for this user
    const { data: integration, error } = await supabase
      .from("gmail_integrations")
      .select("access_token, refresh_token, token_expiry")
      .eq("agent_id", user.id)
      .single();

    if (error || !integration) {
      return NextResponse.json(
        { error: "Google account not connected" }, 
        { status: 400 }
      );
    }

    // Parse request body
    const { title, description, startTime, endTime, location, attendees } = await request.json();

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Title, start time, and end time are required" }, 
        { status: 400 }
      );
    }

    // Create OAuth2 client and set credentials
    const auth = makeOAuth2Client();
    auth.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: new Date(integration.token_expiry).getTime(),
    });

    // Auto-refresh if expired (or within 60s of expiry)
    const expiryMs = new Date(integration.token_expiry).getTime();
    if (Date.now() >= expiryMs - 60_000) {
      try {
        const { credentials } = await auth.refreshAccessToken();
        auth.setCredentials(credentials);

        if (credentials.access_token) {
          await supabase
            .from("gmail_integrations")
            .update({
              access_token: credentials.access_token,
              token_expiry: new Date(credentials.expiry_date ?? Date.now() + 3600_000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("agent_id", user.id);
        }
      } catch (err) {
        // Never log the raw Gaxios error: it embeds the refresh token.
        console.error(
          "[calendar] token refresh failed for agent",
          user.id,
          err instanceof Error ? err.message : "unknown error",
        );
        return NextResponse.json(
          { error: "Failed to refresh Google token" }, 
          { status: 401 }
        );
      }
    }

    // Create Google Calendar API client
    const calendar = google.calendar({ version: "v3", auth });

    // Create the event
    const event = {
      summary: title,
      description: description || "",
      start: {
        dateTime: startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ...(location && { location }),
      ...(attendees && attendees.length > 0 && {
        attendees: attendees.map((email: string) => ({ email }))
      }),
    };

    const createdEvent = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    return NextResponse.json({ 
      success: true, 
      event: createdEvent.data 
    });
  } catch (error) {
    console.error("[calendar/events] Error creating calendar event:", error);
    return NextResponse.json(
      { error: "Failed to create calendar event" }, 
      { status: 500 }
    );
  }
}
