import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <p className="font-heading text-[28px]">Not found</p>
      <p className="mt-2 max-w-xs font-display text-body text-muted-foreground">
        This page doesn&apos;t exist, or it belongs to another account.
      </p>
      <Link href="/dashboard" className="mt-6 rounded-full bg-primary px-5 py-2.5 font-display text-body font-semibold text-primary-foreground">
        Back to Today
      </Link>
    </div>
  );
}
