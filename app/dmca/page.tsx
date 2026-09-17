import { PolicyLink, PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DMCA Policy | Aria",
  description: "DMCA takedown and copyright policy for Aria.",
};

export default async function DmcaPage() {
  const profile = await getComplianceProfileServer();
  const supportEmail = profile.supportEmail;

  return (
    <PolicyPage title="DMCA / Copyright Policy" subtitle="Reporting copyright infringement on Aria.">
      <PolicySection heading="Takedown notices">
        <p>
          If you believe content on Aria infringes your copyright, send a written DMCA notice
          including:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your physical or electronic signature.</li>
          <li>Identification of the copyrighted work.</li>
          <li>Identification of the allegedly infringing material and where it appears.</li>
          <li>Your contact information.</li>
          <li>A statement of good-faith belief that use is unauthorized.</li>
          <li>
            A statement that the notice is accurate and, under penalty of perjury, that you are
            authorized to act.
          </li>
        </ul>
      </PolicySection>

      <PolicySection heading="Counter-notices">
        <p>
          If you believe content was removed in error, you may submit a counter-notice with
          legally required information under the DMCA.
        </p>
      </PolicySection>

      <PolicySection heading="Designated agent">
        {supportEmail ? (
          <p>
            Send DMCA notices and counter-notices to{" "}
            <PolicyLink href={`mailto:${supportEmail}`}>{supportEmail}</PolicyLink>.
          </p>
        ) : (
          <p>
            A designated DMCA agent contact hasn&apos;t been set up yet. Reach us via our{" "}
            <PolicyLink href="/contact">Contact</PolicyLink> page in the meantime.
          </p>
        )}
      </PolicySection>
    </PolicyPage>
  );
}
