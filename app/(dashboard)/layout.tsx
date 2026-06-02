import { AppHeader } from "@/components/AppHeader";
import { AutomationRunner } from "@/components/AutomationRunner";
import { BottomNav } from "@/components/BottomNav";
import { PageShell } from "@/components/PageShell";
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

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden pb-24" style={{ background: "#0a0a0a" }}>
      <AutomationRunner />
      <AppHeader />
      <PageShell>{children}</PageShell>
      <BottomNav />
    </div>
  );
}
