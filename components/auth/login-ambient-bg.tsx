"use client";

/**
 * Static layered background for login screens.
 * No infinite animations — single-pass render, zero motion loop.
 */
export function LoginAmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020202]"
      aria-hidden
    >
      {/* Blue key light — static */}
      <div
        className="absolute left-1/2 top-[6%] h-[72vh] w-[165vw] max-w-[1400px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 38%, rgba(58,101,240,0.12) 0%, rgba(58,101,240,0.04) 38%, transparent 70%)",
        }}
      />
      {/* Cool rim */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 110%, rgba(15,23,42,0.45) 0%, transparent 50%)",
        }}
      />
      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.88) 100%)",
        }}
      />
    </div>
  );
}
