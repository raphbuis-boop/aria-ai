import { PolicyLink, PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact | Aria",
  description: "Contact Aria support and brokerage details.",
};

export default async function ContactPage() {
  const profile = await getComplianceProfileServer();
  const supportEmail = profile.supportEmail;
  const hasBrokerageContact = profile.phone || profile.businessAddress;

  return (
    <PolicyPage title="Contact" subtitle="Questions, support, and account help.">
      <PolicySection heading="Primary support">
        {supportEmail ? (
          <p>
            Email: <PolicyLink href={`mailto:${supportEmail}`}>{supportEmail}</PolicyLink>
          </p>
        ) : (
          <p>Support contact hasn&apos;t been set up yet.</p>
        )}
      </PolicySection>

      {hasBrokerageContact ? (
        <PolicySection heading="Brokerage contact">
          <p>
            {profile.phone ? (
              <>
                Phone: {profile.phone}
                <br />
              </>
            ) : null}
            {profile.businessAddress ? <>Address: {profile.businessAddress}</> : null}
          </p>
        </PolicySection>
      ) : null}
    </PolicyPage>
  );
}
