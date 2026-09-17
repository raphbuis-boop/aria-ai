import { PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { EQUAL_HOUSING_DISCLOSURE, getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About | Aria",
  description: "About Aria real estate platform.",
};

export default async function AboutPage() {
  const profile = await getComplianceProfileServer();
  const hasAgentDetails = profile.legalName && profile.licenseNumber && profile.brokerageName;

  return (
    <PolicyPage
      title="About Aria"
      subtitle="AI-powered real estate platform for New Jersey agents and clients."
    >
      <PolicySection heading="Platform overview">
        <p>
          Aria helps real estate professionals manage relationships, track pipeline activity,
          match buyers with listings, and handle communication workflows in one place.
        </p>
      </PolicySection>

      {hasAgentDetails ? (
        <PolicySection heading="Licensed real estate professional">
          <p>
            Agent: {profile.legalName}
            <br />
            Agent License: {profile.licenseNumber}
            {profile.licenseState ? ` (${profile.licenseState})` : ""}
            <br />
            Brokerage: {profile.brokerageName}
          </p>
        </PolicySection>
      ) : null}

      <PolicySection heading="Equal Housing Opportunity">
        <p>{profile.fairHousingStatement || EQUAL_HOUSING_DISCLOSURE}</p>
      </PolicySection>
    </PolicyPage>
  );
}
