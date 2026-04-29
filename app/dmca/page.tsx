import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA Policy | Aria",
  description: "DMCA takedown and copyright policy for Aria.",
};

export default function DmcaPage() {
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
            DMCA / Copyright Policy
          </h1>
          <p className="mt-2 text-[13px] text-text-dim">
            Reporting copyright infringement on Aria.
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Takedown notices
            </h2>
            <p className="mt-2">
              If you believe content on Aria infringes your copyright, send a
              written DMCA notice including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the copyrighted work.</li>
              <li>
                Identification of the allegedly infringing material and where it
                appears.
              </li>
              <li>Your contact information.</li>
              <li>
                A statement of good-faith belief that use is unauthorized.
              </li>
              <li>
                A statement that the notice is accurate and, under penalty of
                perjury, that you are authorized to act.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Counter-notices
            </h2>
            <p className="mt-2">
              If you believe content was removed in error, you may submit a
              counter-notice with legally required information under the DMCA.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Designated agent
            </h2>
            <p className="mt-2">
              Send DMCA notices and counter-notices to{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-accent-blue hover:underline"
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
