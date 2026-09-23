import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Aria",
  description: "How Aria handles personal data for real estate services.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Effective date: {new Date().toLocaleDateString("en-US")}
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border bg-card p-5 text-[14px] leading-relaxed text-foreground/75">
          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Information we collect
            </h2>
            <p className="mt-2">
              Aria may collect contact information (name, email, phone), account
              data, listing preferences, communication history, and activity logs
              needed to operate our real estate CRM and communication tools.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              How we use your information
            </h2>
            <p className="mt-2">
              We use your data to provide CRM features, surface property matches,
              generate draft communications, support SMS messaging workflows, and
              maintain account security and platform performance.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Service providers and infrastructure
            </h2>
            <p className="mt-2">
              Aria uses third-party providers to operate the platform:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Supabase for authentication, database, and secure storage.</li>
              <li>Anthropic API for AI-generated drafting and analysis features.</li>
              <li>Your device&apos;s native Messages app for SMS — Aria opens a pre-filled text for you to send yourself; no third-party SMS carrier or gateway handles the message.</li>
              <li>Vercel for application hosting, delivery, and runtime logs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Data sharing and sale of data
            </h2>
            <p className="mt-2">
              We do not sell personal information. We share data only with service
              providers that help us run Aria, and only to the extent needed to
              deliver the service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Account deletion and retention
            </h2>
            <p className="mt-2">
              To request account deletion, email{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-primary hover:underline"
              >
                support@getariaai.com
              </a>
              . We will process deletion requests within a commercially reasonable
              timeframe, subject to legal, fraud-prevention, and recordkeeping
              obligations.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              New Jersey jurisdiction
            </h2>
            <p className="mt-2">
              This Privacy Policy is governed by the laws of the State of New
              Jersey, without regard to conflict-of-law rules. Any disputes
              relating to this policy are subject to applicable New Jersey venue
              and jurisdiction requirements.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data? Contact{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-primary hover:underline"
              >
                support@getariaai.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
