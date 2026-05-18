"use client";

import { createClient } from "@/lib/supabase/client";
import { LoginAmbientBackground } from "@/components/auth/login-ambient-bg";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FFC107"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#FF3D00"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#4CAF50"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#1976D2"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
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
      if (err) {
        setError(err.message);
      }
    },
    [supabase.auth],
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.06 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: easeOut },
    },
  };

  return (
    <div className="relative isolate min-h-[100dvh] w-full text-white">
      <LoginAmbientBackground />

      <motion.div
        className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(3.25rem,env(safe-area-inset-top)+2.25rem)]"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={item}
          className="flex flex-1 flex-col items-center justify-center"
        >
          {/* Logo cluster */}
          <div className="flex flex-col items-center">
            <motion.div
              className="relative mb-6 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.95, ease: easeOut }}
            >
              {/* Soft bloom */}
              <motion.div
                aria-hidden
                className="absolute h-40 w-40 rounded-full bg-[#3B82F6]/35"
                style={{ filter: "blur(52px)" }}
                animate={{
                  opacity: [0.32, 0.52, 0.32],
                  scale: [0.94, 1.06, 0.94],
                }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
              >
                <Image
                  src="/aria-logo.png"
                  alt="Aria"
                  width={120}
                  height={120}
                  priority
                  sizes="120px"
                  className="relative z-[1] h-[104px] w-[104px] select-none md:h-[120px] md:w-[120px]"
                />
              </motion.div>
            </motion.div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/50">
              Aria
            </p>
            <h1 className="max-w-[18rem] text-center text-[15px] font-medium leading-snug tracking-tight text-white/95 md:text-base">
              Your AI real estate operator.
            </h1>
            <p className="mt-2 max-w-[20rem] text-center text-[12px] font-medium uppercase tracking-[0.22em] text-white/38">
              Talk · Delegate · Close
            </p>
          </div>
        </motion.div>

        {/* Auth rail */}
        <motion.div
          variants={item}
          className="relative z-10 mt-10 w-full max-w-[360px] space-y-3 md:mt-14"
        >
          {error ? (
            <p className="text-center text-[12px] text-amber-200/90">{error}</p>
          ) : null}

          <motion.button
            type="button"
            disabled={busy !== null}
            onClick={() => void oauth("apple")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 pl-5 pr-5 text-sm font-medium text-black transition-colors hover:bg-white/92 active:bg-white/88 disabled:pointer-events-none disabled:opacity-50"
          >
            <AppleGlyph className="h-[18px] w-[14px] shrink-0" />
            Continue with Apple
          </motion.button>

          <motion.button
            type="button"
            disabled={busy !== null}
            onClick={() => void oauth("google")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="flex w-full items-center justify-center gap-2 rounded-full border-[0.5px] border-[#2a2a2a] bg-[#151515] py-3.5 pl-5 pr-5 text-sm font-medium text-white transition-colors hover:border-[#333] hover:bg-[#1b1b1b] disabled:pointer-events-none disabled:opacity-50"
          >
            <GoogleGlyph className="h-4 w-4 shrink-0" />
            Continue with Google
          </motion.button>

          <motion.div className="grid grid-cols-2 gap-2 pt-1" variants={item}>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              disabled={busy !== null}
              className="rounded-full bg-[#151515] py-3 px-4 text-[13px] font-medium text-white/90 transition hover:bg-[#1b1b1b] disabled:opacity-50"
            >
              Sign up
            </button>
            <Link
              href="/login/email"
              className="flex items-center justify-center rounded-full border-[0.5px] border-[#2a2a2a] py-3 px-4 text-[13px] font-medium text-white transition hover:bg-white/[0.04]"
            >
              Log in
            </Link>
          </motion.div>

          <motion.p
            variants={item}
            className="pt-5 text-center text-[11px] leading-relaxed text-[#5c5c5c]"
          >
            AI revenue OS for NJ agents — not generic CRM middleware.
          </motion.p>

          <motion.p variants={item} className="text-center text-[11px] leading-relaxed text-[#666]">
            By using Aria you agree to the{" "}
            <Link href="/terms" className="text-neutral-400 underline-offset-2 hover:text-neutral-300 hover:underline">
              Terms
            </Link>{" "}
            &amp;{" "}
            <Link
              href="/privacy"
              className="text-neutral-400 underline-offset-2 hover:text-neutral-300 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
