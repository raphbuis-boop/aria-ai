import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmailsClient } from "./emails-client";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <EmailsClient />;
}
