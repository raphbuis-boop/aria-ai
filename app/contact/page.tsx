import type { Metadata } from "next";
import Link from "next/link";
import { BROKERAGE_ADDRESS, BROKERAGE_PHONE } from "@/lib/compliance";

export const metadata: Metadata = {
  title: "Contact | Aria",
  description: "Contact Aria support and brokerage details.",
};

export default function ContactPage() {
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
          <h1 className="text-[24px] font-semibold text-text-primary">Contact</h1>
          <p className="mt-2 text-[13px] text-text-dim">
            Questions, support, and account help.
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Primary support
            </h2>
            <p className="mt-2">
              Email:{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-accent-blue hover:underline"
              >
                support@getariaai.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Brokerage contact
            </h2>
            <p className="mt-2">
              Phone: {BROKERAGE_PHONE}
              <br />
              Address: {BROKERAGE_ADDRESS}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
