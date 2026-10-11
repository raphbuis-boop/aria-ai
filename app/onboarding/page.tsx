import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard, type Tone, type WizardStep } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

const TONES: Tone[] = ["warm", "professional", "direct", "casual"];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { gmail?: string; restart?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: google }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("full_name, onboarding_complete, draft_tone, signature")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("gmail_integrations").select("agent_id").eq("agent_id", user.id).maybeSingle(),
  ]);

  // Finished accounts go to Today unless they asked to run setup again
  // (Today's empty state links here with ?restart=1).
  if (profile?.onboarding_complete && searchParams.restart !== "1" && !searchParams.gmail) redirect("/dashboard");

  // Coming back from Google: success → pick clients, failure → retry screen.
  const initialStep: WizardStep = searchParams.gmail === "connected" ? 3 : searchParams.gmail === "error" ? 2 : 1;
  const tone = TONES.includes(profile?.draft_tone as Tone) ? (profile?.draft_tone as Tone) : "warm";

  return (
    <OnboardingWizard
      userId={user.id}
      initialName={(profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? ""}
      initialStep={initialStep}
      googleConnected={Boolean(google) || searchParams.gmail === "connected"}
      googleError={searchParams.gmail === "error"}
      initialTone={tone}
      initialSignature={(profile?.signature as string | null) ?? ""}
    />
  );
}
