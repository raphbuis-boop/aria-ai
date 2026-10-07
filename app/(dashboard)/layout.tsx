// Dashboard layout — auth gate only.
// All structural chrome (header, nav, page shell) lives in AppShell.

import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First run: a brand-new account (setup not finished, no clients yet) goes
  // through onboarding — this also catches Google/Apple sign-ups, which land
  // here directly. Anyone with clients is never bounced.
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("agent_profiles").select("onboarding_complete").eq("id", user.id).maybeSingle(),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
  ]);
  if (!profile?.onboarding_complete && (count ?? 0) === 0) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
