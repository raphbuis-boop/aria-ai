import Link from "next/link";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Demo banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border-card bg-[#0d1a2e] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-blue" />
          <span className="text-[12px] font-medium text-accent-blue">Demo Mode</span>
          <span className="hidden text-[12px] text-text-dim sm:inline">
            — You&apos;re exploring Aria with sample data. Nothing here is saved.
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-md bg-accent-blue px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Sign up free →
        </Link>
      </div>

      {/* Page content */}
      <div className="pb-20">{children}</div>

      {/* Static bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border-card bg-bg-primary">
        <div className="mx-auto flex h-full max-w-lg items-end justify-between px-2 pb-1 pt-1">
          <div className="flex w-[64px] flex-col items-center gap-[9px] pb-1 opacity-40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span className="text-[9px] text-text-dim">Home</span>
          </div>
          <div className="flex w-[64px] flex-col items-center gap-[9px] pb-1 opacity-40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="text-[9px] text-text-dim">Inbox</span>
          </div>
          <div className="relative flex w-[72px] flex-col items-center">
            <div
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1D4ED8] text-white opacity-60"
              style={{ boxShadow: "0 0 0 8px rgba(59,130,246,0.15)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17.5 L5.5 22 L8 14 L2 9 L9.5 9 Z"/></svg>
            </div>
          </div>
          <Link href="/demo" className="flex w-[64px] flex-col items-center gap-[9px] pb-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-blue"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span className="text-[9px] text-accent-blue">Pipeline</span>
          </Link>
          <div className="flex w-[64px] flex-col items-center gap-[9px] pb-1 opacity-40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span className="text-[9px] text-text-dim">Clients</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
