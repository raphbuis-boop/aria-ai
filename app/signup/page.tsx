"use client";

import { LoginAmbientBackground } from "@/components/auth/login-ambient-bg";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ease = [0.2, 0.8, 0.2, 1] as const;

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.8 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function onGoogleSignup() {
    setError(null);
    setGoogleBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteOrigin}/auth/callback` },
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
        emailRedirectTo: `${siteOrigin}/auth/callback`,
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
    // Email confirmation disabled — session returned immediately
    if (data.session) {
      router.push("/onboarding");
      return;
    }
    // User created but needs email confirmation
    if (data.user) {
      setNotice("Check your email to confirm your account, then sign in.");
      return;
    }
    // Supabase returned no user and no error — silent failure (rate limit, blocked domain, etc.)
    setError("Account creation failed. Please try again in a moment or contact support.");
  }

  const anyBusy = loading || googleBusy;

  return (
    <div className="relative isolate min-h-[100dvh] w-full text-white">
      <LoginAmbientBackground />
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[400px] flex-col px-6"
        style={{
          paddingTop: "max(2.75rem, calc(env(safe-area-inset-top) + 1.75rem))",
          paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease }}
          className="mb-8 flex flex-col items-center"
        >
          <Link href="/login" className="transition hover:opacity-80">
            <Image
              src="/aria-logo.png"
              alt="Aria"
              width={72}
              height={72}
              priority
              className="mb-5 h-[60px] w-[60px] md:h-[72px] md:w-[72px]"
            />
          </Link>
          <p className="text-[13px] font-medium text-white/70">Create your account</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease, delay: 0.04 }}
          className="flex flex-1 flex-col"
        >
          {/* Primary: Google SSO */}
          <motion.button
            type="button"
            disabled={anyBusy}
            onClick={() => void onGoogleSignup()}
            whileTap={{ scale: anyBusy ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="flex w-full items-center justify-center gap-2.5 rounded-[8px] border border-[#2a2a2a] bg-[#111] py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-45"
          >
            <GoogleIcon />
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </motion.button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-[11px] text-neutral-600">or sign up with email</span>
            <div className="h-px flex-1 bg-white/6" />
          </div>

          {/* Secondary: email/password */}
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col space-y-4">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
            />
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            {error ? <p className="text-[13px] text-accent-red/90">{error}</p> : null}
            {notice ? <p className="text-[13px] text-accent-green/85">{notice}</p> : null}
            <motion.button
              type="submit"
              disabled={anyBusy}
              whileTap={{ scale: anyBusy ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
              className="mt-2 w-full rounded-[8px] bg-accent-blue py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
            >
              {loading ? "Creating…" : "Sign up"}
            </motion.button>
          </form>

          <p className="pt-6 text-center text-[13px] text-neutral-500">
            Already have an account?{" "}
            <Link href="/login/email" className="text-neutral-400 hover:text-neutral-300">
              Log in
            </Link>
            {" · "}
            <Link href="/login" className="text-neutral-400 hover:text-neutral-300">
              SSO
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
