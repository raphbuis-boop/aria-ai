import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ gmail?: string }>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("full_name, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  // Already done — send to dashboard
  if (profile?.onboarding_complete) redirect("/dashboard");

  // If Gmail OAuth just returned, start wizard on step 3 (import)
  const params = await searchParams;
  const gmailResult = params.gmail; // "connected" | "error" | undefined
  const initialStep = gmailResult === "connected" ? 3 : 1;
  const gmailConnected = gmailResult === "connected";

  const fullName =
    (profile?.full_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  return (
    <OnboardingWizard
      userId={user.id}
      initialName={fullName}
      initialStep={initialStep as 1 | 2 | 3 | 4}
      gmailConnected={gmailConnected}
    />
  );
}
