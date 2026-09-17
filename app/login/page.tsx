"use client";

import {
  AuthField,
  AuthGoogleButton,
  AuthPasswordField,
  AuthPrimaryButton,
} from "@/components/auth/auth-form";
import { AuthDivider, AuthErrorText, AuthFooter, AuthHeader, AuthPage, GREEN, authSiteOrigin } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPage>{null}</AuthPage>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function onGoogleSignIn() {
    setError(null);
    setGoogleBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authSiteOrigin()}/auth/callback` },
    });
    setGoogleBusy(false);
    if (err) setError(err.message);
  }

  const anyBusy = loading || googleBusy;

  return (
    <AuthPage>
      <AuthHeader title="Sign in to Aria" subtitle="Welcome back. Pick up where you left off." />

      <div className="flex flex-1 flex-col">
        {error ? <AuthErrorText>{error}</AuthErrorText> : null}

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            forgotPasswordHref="/login/forgot-password"
          />
          <AuthPrimaryButton type="submit" disabled={anyBusy}>
            {loading ? "Signing in…" : "Sign in"}
          </AuthPrimaryButton>
        </form>

        <AuthDivider />

        <AuthGoogleButton onClick={() => void onGoogleSignIn()} disabled={anyBusy}>
          {googleBusy ? "Redirecting…" : "Continue with Google"}
        </AuthGoogleButton>

        <AuthFooter>
          New to Aria?{" "}
          <Link href="/signup" className="font-semibold hover:opacity-70" style={{ color: GREEN }}>
            Create an account
          </Link>
        </AuthFooter>
      </div>
    </AuthPage>
  );
}
