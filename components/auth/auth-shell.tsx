"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Shared visual system for every public auth screen (login, signup,
 * forgot/reset password). Matches the ivory/deep-green brand already shipped
 * — do not fork a separate palette per page.
 */
export const ease = [0.2, 0.8, 0.2, 1] as const;

export const IVORY = "#FAF6EE";
export const INK = "#2B2419";
export const MUTED = "#6f6656";
export const GREEN = "#1F5C46";
export const BORDER = "rgba(43,36,25,0.12)";
export const ERROR = "#B84B33";

export function authSiteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
}

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[100dvh] w-full" style={{ background: IVORY, color: INK }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% -5%, rgba(31,92,70,0.10), transparent 65%)" }}
      />
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[400px] flex-col px-6"
        style={{
          paddingTop: "max(2.75rem, calc(env(safe-area-inset-top) + 1.75rem))",
          paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
          className="mb-4 h-[56px] w-[56px] md:h-[64px] md:w-[64px]"
        />
      </Link>
      <h1 className="font-heading text-[24px] font-semibold" style={{ color: INK }}>
        {title}
      </h1>
      <p className="mt-1 text-[13px] font-medium" style={{ color: MUTED }}>
        {subtitle}
      </p>
    </motion.div>
  );
}

export function AuthDivider({ label = "OR" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator">
      <div className="h-px flex-1" style={{ background: BORDER }} />
      <span className="text-[11px] font-semibold tracking-wide" style={{ color: MUTED }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: BORDER }} />
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <p className="pt-6 text-center text-[13px]" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

export function AuthErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[13px]" style={{ color: ERROR }} role="alert">
      {children}
    </p>
  );
}

export function AuthNoticeText({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[13px]" style={{ color: GREEN }} role="status">
      {children}
    </p>
  );
}
