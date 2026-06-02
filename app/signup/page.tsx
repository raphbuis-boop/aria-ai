"use client";

import { LoginAmbientBackground } from "@/components/auth/login-ambient-bg";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);

    if (process.env.NODE_ENV === "development") {
      console.log("[signup] response:", { user: data.user?.id, session: !!data.session, error: err });
    }

    if (err) {
      setError(err.message);
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
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[400px] flex-col px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(2.75rem,env(safe-area-inset-top)+1.75rem)]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
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
          <p className="text-[13px] font-medium text-white/80">Create your account</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-1 flex-col space-y-4"
        >
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            className="w-full rounded-xl border-[0.5px] border-[#2a2a2a] bg-[#111] px-4 py-3.5 text-[15px] text-white placeholder:text-neutral-600 outline-none transition focus:border-[#3B82F6]/60 focus:ring-0"
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border-[0.5px] border-[#2a2a2a] bg-[#111] px-4 py-3.5 text-[15px] text-white placeholder:text-neutral-600 outline-none transition focus:border-[#3B82F6]/60 focus:ring-0"
          />
          {error ? <p className="text-[13px] text-amber-200/90">{error}</p> : null}
          {notice ? <p className="text-[13px] text-emerald-200/85">{notice}</p> : null}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="mt-2 w-full rounded-full bg-[#151515] py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#1c1c1c] disabled:opacity-55"
          >
            {loading ? "Creating…" : "Sign up"}
          </motion.button>

          <p className="pt-6 text-center text-[13px] text-neutral-500">
            Already have an account?{" "}
            <Link href="/login/email" className="text-neutral-300 hover:text-white">
              Log in
            </Link>
            {" · "}
            <Link href="/login" className="text-neutral-300 hover:text-white">
              SSO
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
