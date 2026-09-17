import Link from "next/link";
import type { ReactNode } from "react";

// Same ivory/deep-green brand as the public auth screens (login/signup) —
// duplicated here (not imported) so this branch and the auth branch don't
// need to depend on each other's files. Keep these five values in sync with
// components/auth/auth-shell.tsx if the brand palette ever changes.
const IVORY = "#FAF6EE";
const INK = "#2B2419";
const MUTED = "#6f6656";
const GREEN = "#1F5C46";
const BORDER = "rgba(43,36,25,0.12)";

/** Shared visual system for public policy/compliance pages — matches the ivory/green auth brand. */
export function PolicyPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full" style={{ background: IVORY, color: INK }}>
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:px-6">
        <Link href="/" className="text-[13px] font-semibold hover:opacity-70" style={{ color: GREEN }}>
          ← Back
        </Link>

        <header className="mt-6">
          <h1 className="font-heading text-[26px] font-semibold" style={{ color: INK }}>
            {title}
          </h1>
          <p className="mt-2 text-[13.5px]" style={{ color: MUTED }}>
            {subtitle}
          </p>
        </header>

        <div
          className="mt-8 space-y-7 rounded-2xl p-6 text-[14.5px] leading-relaxed sm:p-7"
          style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function PolicySection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold" style={{ color: INK }}>
        {heading}
      </h2>
      <div className="mt-2 space-y-2" style={{ color: INK }}>
        {children}
      </div>
    </section>
  );
}

export function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-medium hover:underline" style={{ color: GREEN }}>
      {children}
    </a>
  );
}
