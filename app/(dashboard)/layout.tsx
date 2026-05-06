import { AutomationRunner } from "@/components/AutomationRunner";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationPanel";
import { VoiceAssistantRoot } from "@/components/VoiceAssistantRoot";
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
    <div className="min-h-screen bg-bg-primary pb-20">
      <AutomationRunner />
      {children}
      <BottomNav />
      <VoiceAssistantRoot />
      <div className="fixed right-4 top-4 z-[60]">
        <NotificationBell />
      </div>
    </div>
  );
}
