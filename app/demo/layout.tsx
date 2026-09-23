import Link from "next/link";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-[#0d1a2e] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-[12px] font-medium text-primary">Demo Mode</span>
          <span className="hidden text-[12px] text-muted-foreground sm:inline">
            — You&apos;re exploring Aria with sample data. Nothing here is saved.
          </span>
        </div>
        <Link
          href="/landing.html"
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Sign up free →
        </Link>
      </div>

      <div className="pb-24">{children}</div>
    </div>
  );
}
