"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function smoothScroll(id: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,10,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: `0.5px solid ${scrolled ? "rgba(255,255,255,0.07)" : "transparent"}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aria-logo.png" alt="Aria" className="w-6 h-6 rounded-[7px]" />
          <span
            className="font-semibold text-[15px]"
            style={{ color: "#F2F0EB", letterSpacing: "-0.02em" }}
          >
            Aria
          </span>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-7">
          {["Features", "Pricing"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              onClick={smoothScroll(label.toLowerCase())}
              className="text-[13.5px] transition-colors hover:text-white/70"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <a
            href="#features"
            onClick={smoothScroll("features")}
            className="hidden sm:block text-[13.5px] font-medium px-4 py-[9px] rounded-full transition-all hover:border-white/25"
            style={{
              color: "rgba(255,255,255,0.65)",
              border: "0.5px solid rgba(255,255,255,0.14)",
            }}
          >
            See Aria in Action
          </a>
          <a
            href="#waitlist"
            onClick={smoothScroll("waitlist")}
            className="text-[13.5px] font-semibold px-4 py-[9px] rounded-full transition-opacity hover:opacity-85"
            style={{ background: "#E8A832", color: "#0A0A0A" }}
          >
            Book a Demo
          </a>
        </div>
      </div>
    </nav>
  );
}
