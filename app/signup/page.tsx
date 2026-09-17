"use client";

import { AuthField, AuthGoogleButton, AuthPasswordField, AuthPrimaryButton } from "@/components/auth/auth-form";
import {
  AuthDivider,
  AuthErrorText,
  AuthFooter,
  AuthHeader,
  AuthNoticeText,
  AuthPage,
  GREEN,
  authSiteOrigin,
} from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function onGoogleSignup() {
    setError(null);
    setGoogleBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authSiteOrigin()}/auth/callback` },
    });
    setGoogleBusy(false);
    if (err) setError(err.message);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${authSiteOrigin()}/auth/callback`,
      },
    });
    setLoading(false);
    if (err) {
      setError(
        /rate.?limit/i.test(err.message)
          ? "Too many signup emails were requested. Please wait a few minutes before trying again."
          : err.message,
      );
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      return;
    }
    if (data.user) {
      setNotice("Check your email to confirm your account, then sign in.");
      return;
    }
    setError("Account creation failed. Please try again in a moment or contact support.");
  }

  const anyBusy = loading || googleBusy;

  return (
    <AuthPage>
      <AuthHeader title="Create your Aria account" subtitle="Start closing more without working more." />

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
          <AuthPasswordField
            label="Password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <AuthPrimaryButton type="submit" disabled={anyBusy}>
            {loading ? "Creating…" : "Create account"}
          </AuthPrimaryButton>
        </form>

        <AuthDivider />

        <AuthGoogleButton onClick={() => void onGoogleSignup()} disabled={anyBusy}>
          {googleBusy ? "Redirecting…" : "Continue with Google"}
        </AuthGoogleButton>

        <AuthFooter>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold hover:opacity-70" style={{ color: GREEN }}>
            Sign in
          </Link>
        </AuthFooter>
      </div>
    </AuthPage>
  );
}
