"use client";

import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const ease = [0.2, 0.8, 0.2, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.16, ease } },
};

function AppleIcon() {
  return (
    <svg width="13" height="15" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

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

export function AriaOAuthLoginExperience() {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<null | "apple" | "google">(null);
  const [error, setError] = useState<string | null>(null);

  const oauth = useCallback(
    async (provider: "apple" | "google") => {
      setError(null);
      setBusy(provider);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      setBusy(null);
      if (err) setError(err.message);
    },
    [supabase.auth],
  );

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden bg-[#050508] px-6"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Ambient glow — toned down */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 700px 500px at 50% 0%, rgba(58,101,240,0.06) 0%, transparent 65%)",
        }}
      />

      <motion.div
        className="relative z-10 flex w-full max-w-[300px] flex-col items-center"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Logo */}
        <motion.div variants={item} className="mb-10 flex flex-col items-center gap-5">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-[22px]"
              style={{
                boxShadow: "0 0 32px rgba(58,101,240,0.18), 0 0 64px rgba(58,101,240,0.08)",
              }}
            />
            <Image
              src="/aria-logo-mark.jpg"
              alt="Aria"
              width={88}
              height={88}
              priority
              className="relative rounded-[20px]"
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[28px] font-bold leading-none tracking-[-0.02em] text-white">
              Aria
            </span>
            <span className="text-[13px] tracking-wide text-[#6b7090]">
              AI Revenue Operating System
            </span>
          </div>
        </motion.div>

        {/* Auth buttons */}
        <motion.div variants={item} className="flex w-full flex-col gap-2.5">
          {error && (
            <p className="mb-1 text-center text-[12px] text-accent-red/80">{error}</p>
          )}

          <motion.button
            type="button"
            disabled={busy !== null}
            onClick={() => void oauth("apple")}
            whileTap={{ scale: 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="flex w-full items-center justify-center gap-2.5 rounded-[8px] bg-white py-[13px] text-[15px] font-medium text-black transition-colors hover:bg-white/92 disabled:pointer-events-none disabled:opacity-45"
          >
            <AppleIcon />
            Continue with Apple
          </motion.button>

          <motion.button
            type="button"
            disabled={busy !== null}
            onClick={() => void oauth("google")}
            whileTap={{ scale: 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="flex w-full items-center justify-center gap-2.5 rounded-[8px] border border-border-card bg-bg-card py-[13px] text-[15px] font-medium text-white transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-45"
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>

          <div className="my-1 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-[11px] text-[#33334a]">or</span>
            <div className="h-px flex-1 bg-white/6" />
          </div>

          <motion.button
            type="button"
            disabled={busy !== null}
            onClick={() => router.push("/signup")}
            whileTap={{ scale: 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="w-full rounded-[8px] bg-accent-blue py-[13px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
          >
            Create account
          </motion.button>

          <Link
            href="/login/email"
            className="mt-1 w-full rounded-[8px] py-[13px] text-center text-[13px] font-medium text-[#6b7090] transition-colors hover:text-[#9498b0]"
          >
            Sign in with email
          </Link>
        </motion.div>

        {/* Legal */}
        <motion.p
          variants={item}
          className="mt-8 text-center text-[11px] leading-relaxed text-[#2e2e46]"
        >
          By continuing you agree to the{" "}
          <Link href="/terms" className="text-[#6b7090] hover:text-white">Terms</Link>{" "}
          &amp;{" "}
          <Link href="/privacy" className="text-[#6b7090] hover:text-white">Privacy Policy</Link>.
        </motion.p>
      </motion.div>
    </div>
  );
}
