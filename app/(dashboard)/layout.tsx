// Dashboard layout — auth gate only.
// All structural chrome (header, nav, page shell) lives in AppShell.

import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

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

  // Allowlist (detected at runtime) AND subscription/trial — see lib/access.ts.
  // Off-gate users land on /billing, which explains why and how to fix it.
  const access = await getAccess(user);
  if (!access.allowed) redirect("/billing");

  return <AppShell>{children}</AppShell>;
}
