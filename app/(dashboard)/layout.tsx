import { AppHeader } from "@/components/AppHeader";
import { AutomationRunner } from "@/components/AutomationRunner";
import { BottomNav } from "@/components/BottomNav";
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-bg-primary pb-24">
      <AutomationRunner />
      <AppHeader />
      {children}
      <BottomNav />
    </div>
  );
}
