import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { isSimplyRetsConfigured } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getRouteSupabase();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configured = isSimplyRetsConfigured();
    
    return NextResponse.json({ 
      configured,
      message: configured ? "MLS feed is connected" : "MLS feed requires board credentials"
    });
  } catch (error) {
    console.error("[mls/status] Error checking MLS status:", error);
    return NextResponse.json(
      { error: "Failed to check MLS status" }, 
      { status: 500 }
    );
  }
}
