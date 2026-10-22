import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { google, calendar_v3 } from "googleapis";
import { getGoogleAuth } from "@/lib/gmail";
import { DEFAULT_TIME_ZONE } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getRouteSupabase();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Decrypts and, when needed, refreshes the stored tokens.
    const googleAuth = await getGoogleAuth(user.id);
    if (!googleAuth) {
      return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
    }
    const { auth } = googleAuth;

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
    // Message only: the raw Google client error embeds the refresh token.
    console.error("[calendar/events] fetching events failed:", error instanceof Error ? error.message : "unknown error");
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

    // Decrypts and, when needed, refreshes the stored tokens.
    const googleAuth = await getGoogleAuth(user.id);
    if (!googleAuth) {
      return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
    }
    const { auth } = googleAuth;

    // Parse request body
    const { title, description, startTime, endTime, location, attendees } = await request.json();

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Title, start time, and end time are required" }, 
        { status: 400 }
      );
    }

    // Create Google Calendar API client
    const calendar = google.calendar({ version: "v3", auth });

    // Create the event
    const event = {
      summary: title,
      description: description || "",
      start: {
        dateTime: startTime,
        // The agent's zone, not the server's (UTC).
        timeZone: DEFAULT_TIME_ZONE,
      },
      end: {
        dateTime: endTime,
        timeZone: DEFAULT_TIME_ZONE,
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
    // Message only: the raw Google client error embeds the refresh token.
    console.error("[calendar/events] creating event failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Failed to create calendar event" }, 
      { status: 500 }
    );
  }
}
