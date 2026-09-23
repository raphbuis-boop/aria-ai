import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Aria",
  description: "Terms governing use of the Aria platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          ← Back
        </Link>

        <header className="mt-6">
          <h1 className="text-[24px] font-semibold text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Effective date: {new Date().toLocaleDateString("en-US")}
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border bg-card p-5 text-[14px] leading-relaxed text-foreground/75">
          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Acceptance of terms
            </h2>
            <p className="mt-2">
              By accessing or using Aria, you agree to these Terms of Service. If
              you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Accounts and eligibility
            </h2>
            <p className="mt-2">
              You are responsible for your account credentials, account activity,
              and ensuring all account information is accurate and current.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Acceptable use
            </h2>
            <p className="mt-2">
              You agree not to misuse Aria, including unauthorized access attempts,
              unlawful communications, scraping, reverse engineering, or use that
              violates applicable real estate, privacy, or anti-spam laws.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              IDX and listing data restrictions
            </h2>
            <p className="mt-2">
              Listing data provided through IDX is for consumers&apos; personal,
              non-commercial use only and may not be used for any purpose other
              than identifying prospective properties a consumer may be interested
              in purchasing. Data is deemed reliable but not guaranteed and must be
              independently verified.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Suspension and termination
            </h2>
            <p className="mt-2">
              We may suspend or terminate access for violations of these terms,
              security risk, abuse, non-payment, legal compliance, or operational
              necessity.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Disclaimer and limitation of liability
            </h2>
            <p className="mt-2">
              Aria is provided on an &quot;as is&quot; and &quot;as available&quot;
              basis. To the maximum extent permitted by law, Aria disclaims
              warranties and is not liable for indirect, incidental, special,
              consequential, or punitive damages, or loss of profits, data, or
              goodwill.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Governing law
            </h2>
            <p className="mt-2">
              These terms are governed by the laws of the State of New Jersey,
              without regard to conflict-of-law principles.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
