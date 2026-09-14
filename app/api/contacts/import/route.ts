import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { google } from "googleapis";
import { makeOAuth2Client } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST() {
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
        console.error("[contacts] token refresh failed for agent", user.id, err);
        return NextResponse.json(
          { error: "Failed to refresh Google token" }, 
          { status: 401 }
        );
      }
    }

    // Create Google People API client
    const people = google.people({ version: "v1", auth });

    // Get connections (contacts)
    const connectionsResponse = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000, // Adjust as needed
      personFields: "names,emailAddresses,phoneNumbers",
    });

    const connections = connectionsResponse.data.connections || [];

    // Transform connections to client format
    const clientsToInsert = [];

    for (const person of connections) {
      // Extract name
      let name = "";
      if (person.names && person.names.length > 0) {
        name = person.names[0].displayName || 
               `${person.names[0].givenName || ""} ${person.names[0].familyName || ""}`.trim();
      }

      // Extract email
      let email = "";
      if (person.emailAddresses && person.emailAddresses.length > 0) {
        email = person.emailAddresses[0].value ?? "";
      }

      // Extract phone
      let phone = "";
      if (person.phoneNumbers && person.phoneNumbers.length > 0) {
        phone = person.phoneNumbers[0].value ?? "";
      }

      // Skip if no meaningful data
      if (!name && !email && !phone) continue;

      // Format phone if exists (using E164 format if we have a function, otherwise keep as-is)
      const formattedPhone = phone ? phone.replace(/\s+/g, '').replace(/[^\d+]/g, '') : "";

      // Prepare client data
      const clientData = {
        name: name || null,
        email: email || null,
        phone: formattedPhone || null,
        source: "google_contacts",
        metadata: {
          imported_from: "google_contacts",
          imported_at: new Date().toISOString(),
          google_resource_name: person.resourceName
        }
      };

      // Only insert if we have at least name or email
      if (clientData.name || clientData.email) {
        clientsToInsert.push(clientData);
      }
    }

    // Insert clients into database (with deduplication handling)
    // We'll insert them and let database constraints handle duplicates
    const insertedClients = [];
    for (const clientData of clientsToInsert) {
      try {
        const { data: inserted, error: insertError } = await supabase
          .from("clients")
          .insert(clientData)
          .select()
          .single();

        if (!insertError && inserted) {
          insertedClients.push(inserted);
        }
        // If there's a duplicate key error, we skip it (deduplication)
      } catch {
        // Silently skip duplicates
        continue;
      }
    }

    return NextResponse.json({ 
      imported: insertedClients.length,
      totalProcessed: connections.length,
      clients: insertedClients
    });
  } catch (error) {
    console.error("[contacts/import] Error importing contacts:", error);
    return NextResponse.json(
      { error: "Failed to import contacts" }, 
      { status: 500 }
    );
  }
}
