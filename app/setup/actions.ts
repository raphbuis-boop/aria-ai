"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function registerAgent(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const licenseState = String(formData.get("licenseState") ?? "NJ").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }
  if (licenseState !== "NJ") {
    return { error: "Only New Jersey is available at this time." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const admin = createAdminClient();
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listErr) {
    return { error: listErr.message };
  }

  if ((list?.users?.length ?? 0) >= 2) {
    return { error: "Access closed." };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create account." };
  }

  const { error: pErr } = await admin.from("agent_profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    license_state: licenseState,
  });

  if (pErr) {
    return { error: pErr.message };
  }

  revalidatePath("/setup");
  return { success: true };
}
