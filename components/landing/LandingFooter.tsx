export default function LandingFooter() {
  return (
    <footer style={{ background: "#FAFAF7", borderTop: "0.5px solid #EEEBE5" }}>
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[13px]" style={{ color: "#9A9AA2" }}>
          © 2026 Aria · Built in NJ
        </span>
        <div className="flex items-center gap-6">
          <a
            href="/privacy"
            className="text-[13px] transition-colors hover:text-[#0B0B0F]"
            style={{ color: "#9A9AA2" }}
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-[13px] transition-colors hover:text-[#0B0B0F]"
            style={{ color: "#9A9AA2" }}
          >
            Terms
          </a>
          <a
            href="/login"
            className="text-[13px] transition-colors hover:text-[#0B0B0F]"
            style={{ color: "#9A9AA2" }}
          >
            Log in
          </a>
        </div>
      </div>
    </footer>
  );
}
