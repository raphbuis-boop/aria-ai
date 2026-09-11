import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getRouteSupabase();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get the agent's voice samples from agent_profiles
    const { data: profile, error } = await supabase
      .from("agent_profiles")
      .select("voice_samples")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("[voice/samples/status] Error fetching voice samples:", error);
      return NextResponse.json(
        { error: "Failed to check voice samples status" }, 
        { status: 500 }
      );
    }

    const voiceSamples = profile?.voice_samples ?? [];
    const hasSamples = Array.isArray(voiceSamples) && voiceSamples.some(sample => sample && sample.trim() !== "");
    
    return NextResponse.json({ 
      configured: hasSamples,
      sampleCount: voiceSamples.filter((s: string) => s && s.trim() !== "").length,
      totalSamples: voiceSamples.length
    });
  } catch (error) {
    console.error("[voice/samples/status] Error checking voice samples status:", error);
    return NextResponse.json(
      { error: "Failed to check voice samples status" }, 
      { status: 500 }
    );
  }
}
