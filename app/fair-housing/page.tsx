import type { Metadata } from "next";
import Link from "next/link";
import { EQUAL_HOUSING_DISCLOSURE } from "@/lib/compliance";

export const metadata: Metadata = {
  title: "Fair Housing Statement | Aria",
  description: "Fair Housing and Equal Housing Opportunity statement.",
};

export default function FairHousingPage() {
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
            Fair Housing Statement
          </h1>
          <p className="mt-2 text-[13px] text-text-dim">
            Equal Housing Opportunity commitment.
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Equal Housing Opportunity
            </h2>
            <p className="mt-2">{EQUAL_HOUSING_DISCLOSURE}</p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Federal Fair Housing Act
            </h2>
            <p className="mt-2">
              We support the Federal Fair Housing Act, which prohibits
              discrimination in housing based on race, color, religion, sex,
              disability, familial status, or national origin.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              New Jersey Law Against Discrimination
            </h2>
            <p className="mt-2">
              We also comply with the New Jersey Law Against Discrimination
              (NJLAD), including applicable protections related to housing and
              real estate services.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
