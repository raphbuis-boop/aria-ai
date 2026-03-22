import { createAdminClient } from "@/lib/supabase/admin";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if ((list?.users?.length ?? 0) >= 2) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4">
        <div className="w-full max-w-md rounded-[16px] border border-border-card bg-bg-card p-8 text-center">
          <h1 className="text-[20px] font-medium text-text-primary">
            Access closed.
          </h1>
          <p className="mt-2 text-[13px] text-text-dim">
            This workspace already has two accounts.
          </p>
        </div>
      </div>
    );
  }

  return <SetupForm />;
}
