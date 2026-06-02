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

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
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

        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease, delay: 0.04 }}
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-1 flex-col space-y-4"
        >
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
            disabled={loading}
            whileTap={{ scale: loading ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="mt-2 w-full rounded-[8px] bg-accent-blue py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
          >
            {loading ? "Creating…" : "Sign up"}
          </motion.button>

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
        </motion.form>
      </div>
    </div>
  );
}
