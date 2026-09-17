"use client";

import { AuthPasswordField, AuthPrimaryButton } from "@/components/auth/auth-form";
import { AuthErrorText, AuthFooter, AuthHeader, AuthNoticeText, AuthPage, GREEN } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNotice("Password updated. Redirecting to your dashboard…");
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthPage>
      <AuthHeader title="Set a new password" subtitle="Choose a new password for your Aria account." />

      <div className="flex flex-1 flex-col">
        {error ? <AuthErrorText>{error}</AuthErrorText> : null}
        {notice ? <AuthNoticeText>{notice}</AuthNoticeText> : null}

        <form onSubmit={(e) => void onSubmit(e)}>
          <AuthPasswordField
            label="New password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </AuthPrimaryButton>
        </form>

        <AuthFooter>
          <Link href="/login" className="font-semibold hover:opacity-70" style={{ color: GREEN }}>
            Back to sign in
          </Link>
        </AuthFooter>
      </div>
    </AuthPage>
  );
}
