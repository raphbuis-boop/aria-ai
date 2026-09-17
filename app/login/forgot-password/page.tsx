"use client";

import { AuthField, AuthPrimaryButton } from "@/components/auth/auth-form";
import { AuthErrorText, AuthFooter, AuthHeader, AuthNoticeText, AuthPage, GREEN, authSiteOrigin } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authSiteOrigin()}/auth/callback?next=/login/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNotice("If an account exists for that email, a reset link is on its way.");
  }

  return (
    <AuthPage>
      <AuthHeader title="Reset your password" subtitle="We'll email you a link to get back into Aria." />

      <div className="flex flex-1 flex-col">
        {error ? <AuthErrorText>{error}</AuthErrorText> : null}
        {notice ? <AuthNoticeText>{notice}</AuthNoticeText> : null}

        <form onSubmit={(e) => void onSubmit(e)}>
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
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
