export function LandingFooter() {
  return (
    <footer
      className="px-6 py-14"
      style={{
        background: "#080D18",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#0B1220]">
            A
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">Aria</span>
        </div>

        <nav className="flex items-center gap-5 text-[13px]">
          <a href="#" className="transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.35)" }}>Privacy</a>
          <span aria-hidden style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <a href="#" className="transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.35)" }}>Terms</a>
          <span aria-hidden style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <a href="#signup" className="transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.35)" }}>Contact</a>
        </nav>

        <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          © 2026 Aria · Built in NJ
        </p>
      </div>
    </footer>
  );
}

export default LandingFooter;
