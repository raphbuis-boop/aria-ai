import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Aria",
  description: "How Aria collects and uses your information.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-[13px] text-text-dim">
            Aria by Get Aria AI
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Information we collect
            </h2>
            <p className="mt-2">
              We may collect your <strong className="text-text-primary">name</strong>,{" "}
              <strong className="text-text-primary">email address</strong>, and{" "}
              <strong className="text-text-primary">phone number</strong> when you or
              your agent use Aria—for example when you are added as a client, sign up
              for communications, or interact with our services.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              How we use your information
            </h2>
            <p className="mt-2">
              We use this information to operate Aria and to help your real estate
              agent stay in touch with you—{" "}
              <strong className="text-text-primary">
                including sending SMS follow-ups on behalf of your agent
              </strong>{" "}
              when they choose to use that feature, and to power related tools
              (such as reminders, drafts, and scheduling) inside the product.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              We don&apos;t sell your data
            </h2>
            <p className="mt-2">
              We do not sell your personal information. We use it only as described
              in this policy and as needed to provide and improve Aria for agents
              and their clients.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data? Reach us at{" "}
              <a
                href="mailto:team@getariaai.com"
                className="font-medium text-accent-blue hover:underline"
              >
                team@getariaai.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
