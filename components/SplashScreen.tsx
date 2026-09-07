"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "aa_splash_shown";
const SPLASH_DURATION_MS = 3500;

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Only show on Capacitor native app, never on web
    const isNative =
      typeof window !== "undefined" &&
      !!(window as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative;
    if (!isNative) return;

    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // sessionStorage unavailable — skip splash
      return;
    }
    setVisible(true);

    const fadeTimer = setTimeout(() => setFading(true), SPLASH_DURATION_MS - 400);
    const hideTimer = setTimeout(() => setVisible(false), SPLASH_DURATION_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes drawPath {
          from { stroke-dashoffset: 800; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fillIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes glowIn {
          from { filter: drop-shadow(0 0 0px rgba(31,92,70,0)); }
          to   { filter: drop-shadow(0 0 18px rgba(31,92,70,0.35)); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.85); opacity: 0.6; }
          100% { transform: scale(2.2);  opacity: 0; }
        }
        @keyframes splashFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .splash-path-outline {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: drawPath 2.2s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        }
        .splash-path-fill {
          opacity: 0;
          animation: fillIn 1s ease-out 1.5s forwards;
        }
        .splash-logo-glow {
          animation: glowIn 0.8s ease-out 2.2s forwards;
          filter: drop-shadow(0 0 0px rgba(31,92,70,0));
        }
        .splash-wordmark {
          opacity: 0;
          animation: fadeUp 0.8s ease-out 2.2s forwards;
        }
        .splash-tagline {
          opacity: 0;
          animation: fadeUp 0.8s ease-out 2.5s forwards;
        }
        .pulse-ring-1 {
          animation: pulse-ring 2.8s ease-out 2.2s infinite;
        }
        .pulse-ring-2 {
          animation: pulse-ring 2.8s ease-out 2.6s infinite;
        }
        .pulse-ring-3 {
          animation: pulse-ring 2.8s ease-out 3.0s infinite;
        }
        .splash-screen-fade {
          animation: splashFadeOut 0.4s ease-out forwards;
        }
      `}</style>

      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${fading ? "splash-screen-fade" : ""}`}
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 28%, rgba(31,92,70,0.10), transparent 60%),
            radial-gradient(ellipse 60% 40% at 50% 82%, rgba(184,132,46,0.06), transparent),
            #FAF6EE
          `,
        }}
      >
        {/* Pulse rings */}
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`absolute rounded-full pulse-ring-${i}`}
              style={{
                width: 80,
                height: 80,
                border: "1px solid rgba(31,92,70,0.35)",
              }}
            />
          ))}

          {/* Logo */}
          <div className="splash-logo-glow relative" style={{ width: 80, height: 80 }}>
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
              <defs>
                <linearGradient id="splash-grad-fill" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#2E7D5B"/>
                  <stop offset="100%" stop-color="#1F5C46"/>
                </linearGradient>
                <linearGradient id="splash-grad-stroke" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#3E9B72"/>
                  <stop offset="100%" stop-color="#2E7D5B"/>
                </linearGradient>
              </defs>
              {/* Filled path — fades in after outline draws */}
              <path
                className="splash-path-fill"
                d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                fill="url(#splash-grad-fill)"
              />
              {/* Outline path — draws itself */}
              <path
                className="splash-path-outline"
                d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                fill="none"
                stroke="url(#splash-grad-stroke)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <p
          className="splash-wordmark mt-6 text-[44px] text-[#2B2419]"
          style={{ letterSpacing: "-0.03em", fontFamily: "var(--font-fraunces), serif" }}
        >
          aria
        </p>

        {/* Tagline */}
        <p
          className="splash-tagline mt-2 text-[14px]"
          style={{ color: "#8A7F6C" }}
        >
          Your real estate teammate.
        </p>
      </div>
    </>
  );
}
