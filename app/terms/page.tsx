import { PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Aria",
  description: "Terms governing use of the Aria platform.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      subtitle={`Effective date: ${new Date().toLocaleDateString("en-US")}`}
    >
      <PolicySection heading="Acceptance of terms">
        <p>
          By accessing or using Aria, you agree to these Terms of Service. If you do not agree,
          do not use the platform.
        </p>
      </PolicySection>

      <PolicySection heading="Accounts and eligibility">
        <p>
          You are responsible for your account credentials, account activity, and ensuring all
          account information is accurate and current.
        </p>
      </PolicySection>

      <PolicySection heading="Acceptable use">
        <p>
          You agree not to misuse Aria, including unauthorized access attempts, unlawful
          communications, scraping, reverse engineering, or use that violates applicable real
          estate, privacy, or anti-spam laws.
        </p>
      </PolicySection>

      <PolicySection heading="IDX and listing data restrictions">
        <p>
          Listing data provided through IDX is for consumers&apos; personal, non-commercial use
          only and may not be used for any purpose other than identifying prospective properties
          a consumer may be interested in purchasing. Data is deemed reliable but not guaranteed
          and must be independently verified.
        </p>
      </PolicySection>

      <PolicySection heading="Suspension and termination">
        <p>
          We may suspend or terminate access for violations of these terms, security risk, abuse,
          non-payment, legal compliance, or operational necessity.
        </p>
      </PolicySection>

      <PolicySection heading="Disclaimer and limitation of liability">
        <p>
          Aria is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
          maximum extent permitted by law, Aria disclaims warranties and is not liable for
          indirect, incidental, special, consequential, or punitive damages, or loss of profits,
          data, or goodwill.
        </p>
      </PolicySection>

      <PolicySection heading="Governing law">
        <p>
          These terms are governed by the laws of the State of New Jersey, without regard to
          conflict-of-law principles.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
