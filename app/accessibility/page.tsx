import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility Statement | Aria",
  description: "Aria accessibility commitment and support contact.",
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-bg-primary px-4 pb-16 pt-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="text-[13px] font-medium text-accent-blue hover:underline"
        >
          ← Back
        </Link>

        <header className="mt-6">
          <h1 className="text-[24px] font-semibold text-text-primary">
            Accessibility Statement
          </h1>
          <p className="mt-2 text-[13px] text-text-dim">
            Our commitment to accessible digital experiences.
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Commitment
            </h2>
            <p className="mt-2">
              Aria is committed to providing an accessible website and product
              experience for all users. We work toward conformance with WCAG 2.1
              Level AA standards.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Ongoing improvements
            </h2>
            <p className="mt-2">
              Accessibility is an ongoing effort. We regularly review product
              interfaces and content to improve keyboard navigation, contrast,
              semantic structure, and assistive technology support.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Contact for accessibility issues
            </h2>
            <p className="mt-2">
              If you encounter accessibility barriers, email{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-accent-blue hover:underline"
              >
                support@getariaai.com
              </a>{" "}
              with details so we can investigate and address the issue.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
