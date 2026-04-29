import type { Metadata } from "next";
import Link from "next/link";
import {
  AGENT_LICENSE,
  AGENT_NAME,
  BROKERAGE_LICENSE,
  BROKERAGE_NAME,
  EQUAL_HOUSING_DISCLOSURE,
} from "@/lib/compliance";

export const metadata: Metadata = {
  title: "About | Aria",
  description: "About Aria real estate platform.",
};

export default function AboutPage() {
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
          <h1 className="text-[24px] font-semibold text-text-primary">About Aria</h1>
          <p className="mt-2 text-[13px] text-text-dim">
            AI-powered real estate platform for New Jersey agents and clients.
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border-card bg-bg-card p-5 text-[14px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Platform overview
            </h2>
            <p className="mt-2">
              Aria helps real estate professionals manage relationships, track
              pipeline activity, match buyers with listings, and handle
              communication workflows in one place.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Licensed real estate professional
            </h2>
            <p className="mt-2">
              Agent: {AGENT_NAME}
              <br />
              Agent License: {AGENT_LICENSE}
              <br />
              Brokerage: {BROKERAGE_NAME}
              <br />
              Brokerage License: {BROKERAGE_LICENSE}
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text-primary">
              Equal Housing Opportunity
            </h2>
            <p className="mt-2">{EQUAL_HOUSING_DISCLOSURE}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
