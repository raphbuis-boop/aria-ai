import { AutomationRunner } from "@/components/AutomationRunner";
import { createClient } from "@/lib/supabase/server";
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Aria — Mobile",
  description: "Aria CRM for mobile",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default async function MobileLayout({
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
    <div className="flex min-h-dvh flex-col bg-[#0a0a0f] text-[#f0eee8]">
      <AutomationRunner />
      <div className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top,0px)]">
        {children}
      </div>
    </div>
  );
}
