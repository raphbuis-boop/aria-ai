import { PolicyLink, PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | Aria",
  description: "How Aria handles personal data for real estate services.",
};

export default async function PrivacyPage() {
  const profile = await getComplianceProfileServer();
  const supportEmail = profile.supportEmail;

  return (
    <PolicyPage
      title="Privacy Policy"
      subtitle={`Effective date: ${new Date().toLocaleDateString("en-US")}`}
    >
      <PolicySection heading="Information we collect">
        <p>
          Aria may collect contact information (name, email, phone), account data, listing
          preferences, communication history, and activity logs needed to operate our real
          estate CRM and communication tools.
        </p>
      </PolicySection>

      <PolicySection heading="How we use your information">
        <p>
          We use your data to provide CRM features, surface property matches, generate draft
          communications, support SMS messaging workflows, and maintain account security and
          platform performance.
        </p>
      </PolicySection>

      <PolicySection heading="Service providers and infrastructure">
        <p>Aria uses third-party providers to operate the platform:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase for authentication, database, and secure storage.</li>
          <li>Anthropic API for AI-generated drafting and analysis features.</li>
          <li>
            Your device&apos;s native Messages app for SMS — Aria opens a pre-filled text for you
            to send yourself; no third-party SMS carrier or gateway handles the message.
          </li>
          <li>Vercel for application hosting, delivery, and runtime logs.</li>
        </ul>
      </PolicySection>

      <PolicySection heading="Data sharing and sale of data">
        <p>
          We do not sell personal information. We share data only with service providers that
          help us run Aria, and only to the extent needed to deliver the service.
        </p>
      </PolicySection>

      <PolicySection heading="Account deletion and retention">
        {supportEmail ? (
          <p>
            To request account deletion, email <PolicyLink href={`mailto:${supportEmail}`}>{supportEmail}</PolicyLink>.
            We will process deletion requests within a commercially reasonable timeframe, subject
            to legal, fraud-prevention, and recordkeeping obligations.
          </p>
        ) : (
          <p>
            To request account deletion, contact us through the support address on our{" "}
            <PolicyLink href="/contact">Contact</PolicyLink> page. We will process deletion
            requests within a commercially reasonable timeframe, subject to legal,
            fraud-prevention, and recordkeeping obligations.
          </p>
        )}
      </PolicySection>

      <PolicySection heading="New Jersey jurisdiction">
        <p>
          This Privacy Policy is governed by the laws of the State of New Jersey, without regard
          to conflict-of-law rules. Any disputes relating to this policy are subject to
          applicable New Jersey venue and jurisdiction requirements.
        </p>
      </PolicySection>

      <PolicySection heading="Contact">
        {supportEmail ? (
          <p>
            Questions about this policy or your data? Contact{" "}
            <PolicyLink href={`mailto:${supportEmail}`}>{supportEmail}</PolicyLink>.
          </p>
        ) : (
          <p>
            Questions about this policy or your data? Reach us via our{" "}
            <PolicyLink href="/contact">Contact</PolicyLink> page.
          </p>
        )}
      </PolicySection>
    </PolicyPage>
  );
}
