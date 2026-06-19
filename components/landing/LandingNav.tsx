"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const links = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ top: "calc(20px + env(safe-area-inset-top, 0px))" }}
    >
      <nav className="w-full max-w-3xl">
        <div
          className="flex items-center justify-between gap-6 rounded-full px-5 py-3"
          style={{
            background: "rgba(11,18,32,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Logo */}
          <a href="#top" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#0B1220]">
              A
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">Aria</span>
          </a>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white/75"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/login"
              className="text-[13px] font-medium text-white/45 transition-colors hover:text-white/75"
            >
              Log in
            </a>
            <a
              href="#signup"
              className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0B1220] transition-opacity hover:opacity-90"
            >
              Get access
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="text-white/50 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-2 rounded-2xl p-4 md:hidden"
              style={{
                background: "rgba(11,18,32,0.97)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex flex-col gap-1">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-2 flex flex-col gap-2">
                  <a
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/10 px-5 py-2.5 text-center text-sm font-medium text-white/50"
                  >
                    Log in
                  </a>
                  <a
                    href="#signup"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-semibold text-[#0B1220]"
                  >
                    Get access
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}

export default LandingNav;
