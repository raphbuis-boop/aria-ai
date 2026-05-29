"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function scrollToWaitlist(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: "rgba(250,250,247,0.92)",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `0.5px solid ${scrolled ? "#EEEBE5" : "transparent"}`,
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aria-logo.png"
            alt="Aria"
            className="w-6 h-6 rounded-[7px]"
          />
          <span
            className="font-semibold text-[15px]"
            style={{ color: "#0B0B0F", letterSpacing: "-0.02em" }}
          >
            Aria
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-[13.5px] transition-colors hover:text-[#0B0B0F]"
            style={{ color: "#4A4A52" }}
          >
            Log in
          </Link>
          <a
            href="#waitlist"
            onClick={scrollToWaitlist}
            className="text-[13.5px] font-medium px-4 py-[9px] rounded-full transition-colors hover:opacity-80"
            style={{ background: "#0B0B0F", color: "#fff" }}
          >
            Get early access
          </a>
        </div>
      </div>
    </nav>
  );
}
