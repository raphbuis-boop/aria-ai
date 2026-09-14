export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-[100dvh] bg-background px-6 pt-10 pb-32 text-foreground">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-9 w-40 rounded-lg bg-secondary" />
        <div className="h-36 rounded-3xl border border-border bg-card" />
        <div className="h-64 rounded-3xl border border-border bg-card" />
      </div>
    </div>
  );
}
